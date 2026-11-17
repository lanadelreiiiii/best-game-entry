// KITEWARDEN — the game itself. KitewardenGame owns the canvas, the state,
// the combat sim, the renderer, the sound bank and the input, and runs the
// fixed-step loop: the simulation ticks at 60 Hz no matter how fast the
// screen draws, so the game plays the same on a slow laptop and a fast one.
// Every player action in the game — build, upgrade, sell, turn a wind
// vane, start a wave, choose a blessing, restart — is a method here.

import { GameState } from './game.js';
import { Combat } from './combat.js';
import { Renderer } from './render.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { TOWERS, upgradeCost, SELL_REFUND, towerStats } from './towers.js';
import { buildWave, spawnEnemy, TOTAL_WAVES } from './waves.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60; // fixed sim step, seconds

export class KitewardenGame {
  constructor(canvas, seed = 1) {
    this.canvas = canvas;
    this.state = new GameState(seed);
    this.combat = new Combat(this.state);
    this.renderer = new Renderer(canvas);
    this.audio = new SoundBank();
    this.state.audio = this.audio;
    this.input = new Input(this, canvas);
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.shot = null; // staged screenshot state, set by ?shot=
  }

  // Boot the loop. If the URL carries ?shot=<name>&seed=<n>, the game is
  // staged into that exact scene instead of starting at the title screen.
  boot() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const seed = parseInt(params.get('seed') || '1', 10) || 1;
    if (shot) {
      this.shot = shot;
      stageShot(this, shot, seed);
    }
    this.running = true;
    this.lastTime = performance.now();
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;
      try {
        this.frame(dt);
      } catch (err) {
        // One bad tick must never freeze the game in front of a player.
        console.error('kitewarden tick error', err);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  frame(dt) {
    const s = this.state;
    if (!s.paused && (s.phase === 'playing' || s.phase === 'blessing')) {
      this.accumulator += dt * s.speed;
      let guard = 0;
      while (this.accumulator >= STEP && guard < 12) {
        this.stepSim(STEP);
        this.accumulator -= STEP;
        guard++;
      }
      if (guard >= 12) this.accumulator = 0;
    }
    this.audio.setWind(s.wind.effectiveStrength());
    this.renderer.draw(s);
  }

  stepSim(dt) {
    const s = this.state;
    s.tick++;
    s.time += dt;
    if (s.phase === 'playing' && s.waveState !== 'idle') {
      this.combat.step(dt);
    } else {
      // Even between waves, particles and floaters settle.
      this.combat.updateParticles(dt);
      this.combat.updateFloaters(dt);
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 30);
    }
  }

  // --- Run control ---

  // Fresh run with a fixed seed (used by screenshot staging, and by
  // startGame with a random seed for real play).
  reset(seed) {
    this.state = new GameState(seed);
    this.combat = new Combat(this.state);
    this.state.audio = this.audio;
  }

  startGame() {
    const seed = (Date.now() % 100000) + 1;
    this.reset(seed);
    this.state.phase = 'playing';
    this.state.banner('Build your kites, then start wave 1.', 4);
    this.audio.ensure();
    this.audio.click();
  }

  restart() {
    this.startGame();
  }

  continueEndless() {
    const s = this.state;
    s.phase = 'playing';
    s.waveState = 'idle';
    s.banner('Endless mode — the storm never ends now.', 4);
    this.audio.click();
  }

  togglePauseOrStart() {
    const s = this.state;
    if (s.phase !== 'playing') return;
    if (s.waveState === 'idle') return this.startWave();
    this.togglePause();
  }

  togglePause() {
    const s = this.state;
    if (s.phase !== 'playing') return;
    s.paused = !s.paused;
    this.audio.click();
  }

  toggleSpeed() {
    const s = this.state;
    s.speed = s.speed === 1 ? 2 : 1;
    this.audio.click();
  }

  toggleMute() {
    const s = this.state;
    s.muted = !s.muted;
    this.audio.setMuted(s.muted);
  }

  clearSelection() {
    this.state.selection = null;
  }

  setBuildType(type) {
    this.state.buildType = type;
  }

  // --- Wind vanes ---

  // Turn one vane 45 degrees clockwise. Free, no gold, legal any time
  // during play — even while a wave is running. The pulse ring, the
  // particles and the chime are the feedback; the floater names the new
  // direction so the change reads without looking at the vane.
  rotateVane(vaneId) {
    const s = this.state;
    if (s.phase !== 'playing' && s.phase !== 'blessing') return null;
    const label = s.vanes.rotate(vaneId, s.time);
    if (label === null) return null;
    const vane = s.vanes.at(vaneId);
    this.combat.burst(vane.x, vane.y, '#5ec8c0', 8);
    this.combat.floater(vane.x, vane.y - 44, `Wind ${label}`, '#5ec8c0');
    s.audio?.vaneClick();
    return label;
  }

  // --- Building ---

  selectNode(nodeId) {
    const s = this.state;
    if (s.nodes[nodeId].tower) return this.selectTower(nodeId);
    s.selection = { kind: 'node', id: nodeId };
    this.audio.click();
  }

  selectTower(nodeId) {
    const s = this.state;
    if (!s.nodes[nodeId].tower) return;
    s.selection = { kind: 'tower', id: nodeId };
    this.audio.click();
  }

  buildAt(nodeId, type) {
    const s = this.state;
    const node = s.nodes[nodeId];
    const def = TOWERS[type];
    if (!node || node.tower || !def) return false;
    if (s.gold < def.cost) {
      s.banner(`Not enough gold for a ${def.name} — need ◈ ${def.cost}.`, 2);
      return false;
    }
    s.gold -= def.cost;
    const tower = {
      def,
      level: 1,
      node,
      x: node.x,
      y: node.y,
      cooldown: 0,
      aim: -Math.PI / 2,
      target: null,
      kills: 0,
      invested: def.cost,
      stats: towerStats(def, 1, { damage: 0, range: 0 }),
    };
    node.tower = tower;
    s.selection = { kind: 'tower', id: nodeId };
    this.audio.build();
    this.combat.burst(node.x, node.y - 10, def.color, 10);
    return true;
  }

  upgradeSelected() {
    const s = this.state;
    if (!s.selection || s.selection.kind !== 'tower') return false;
    const tower = s.towerAt(s.selection.id);
    if (!tower) return false;
    const cost = upgradeCost(tower.def, tower.level);
    if (cost === null || s.gold < cost) return false;
    s.gold -= cost;
    tower.invested += cost;
    tower.level++;
    tower.stats = towerStats(tower.def, tower.level, s.buffsFor(tower.node));
    this.audio.build();
    this.combat.burst(tower.x, tower.y - 10, '#ffd94d', 12);
    return true;
  }

  sellSelected() {
    const s = this.state;
    if (!s.selection || s.selection.kind !== 'tower') return false;
    const tower = s.towerAt(s.selection.id);
    if (!tower) return false;
    s.gold += Math.round(tower.invested * SELL_REFUND);
    tower.node.tower = null;
    s.selection = null;
    this.audio.click();
    return true;
  }

  // --- Waves and blessings ---

  startWave() {
    const s = this.state;
    if (s.phase !== 'playing') return false;
    if (s.waveState === 'spawning' || s.waveState === 'fighting') return false;
    s.wave++;
    s.wind.rollForWave(s.wave, s.rng);
    // Every vane turns to face the new wind at the wave's start; the
    // player then chooses where to diverge from it, for free.
    s.vanes.syncToWind(s.wind.angle);
    const wave = buildWave(s.wave, s.rng);
    // Each spawn carries the lane its wave assigned it; the Scout Kite
    // may re-decide at the fork itself (see combat.js).
    s.spawnQueue = wave.spawns.map((spawn, i) => ({
      enemy: spawnEnemy(spawn.type, s.wave, s.spawnCounter++, spawn.lane),
      gap: i === 0 ? 0.5 : spawn.delay - wave.spawns[i - 1].delay,
    }));
    s.spawnTimer = 0.5;
    s.waveState = 'spawning';
    s.forkSplit = wave.fork ? wave.split : null;
    const boss = wave.boss ? ' — the Storm Serpent comes!' : '';
    const vaneTip = s.wave === 1 ? ' Click a wind vane (free) to turn the local wind!' : '';
    // From wave 3 the banner names the fork split, so the player sees
    // where the storm is going before the first enemy reaches the fork.
    const forkTip = wave.fork
      ? ` — the path forks: Ridge ${wave.split.ridgePct}% / Valley ${100 - wave.split.ridgePct}%`
      : '';
    s.banner(`Wave ${s.wave} — wind ${s.wind.label}, strength ${Math.round(s.wind.strength * 100)}%${boss}${forkTip}${vaneTip}`, 3.5);
    this.audio.click();
    return true;
  }

  chooseBlessing(index) {
    const s = this.state;
    if (s.phase !== 'blessing' || !s.blessingOffer) return false;
    const blessing = s.blessingOffer[index];
    if (!blessing) return false;
    blessing.apply(s);
    s.blessingsTaken.push(blessing.id);
    s.blessingOffer = null;
    s.phase = 'playing';
    s.waveState = 'idle';
    s.banner(`Blessing taken: ${blessing.name}.`, 3);
    this.audio.waveClear();
    return true;
  }
}

// Boot: the canvas on the page starts the game.
const canvas = document.getElementById('game');
const game = new KitewardenGame(canvas);
// Exposed for automated playtests (and for players poking at the console).
window.__kitewarden = game;
const statusEl = document.getElementById('status');
let lastStatus = '';
const announce = () => {
  const s = game.state;
  const text = `KITEWARDEN, wave ${s.waveLabel}, ${s.lives} lives, ${s.gold} gold, score ${s.score}.`;
  if (text !== lastStatus) {
    lastStatus = text;
    if (statusEl) statusEl.textContent = text;
  }
};
setInterval(announce, 1000);
game.boot();
