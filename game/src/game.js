// KITEWARDEN — the single game state. One object holds everything the
// game is: the economy, the wave, the towers on the ridge, the enemies
// walking it, the wind, the wind vanes the player turns, and the blessings
// the player has chosen. The sim reads and writes this object; the
// renderer only reads it.

import { WindModel } from './wind.js';
import { WindVanes } from './vanes.js';
import { BUILD_NODES } from './ridge.js';
import { TOTAL_WAVES } from './waves.js';
import { mulberry32 } from './random.js';

export class GameState {
  constructor(seed = 1) {
    this.seed = seed;
    this.rng = mulberry32(seed); // the run's seeded generator: waves, wind, blessings
    this.phase = 'title'; // title | playing | blessing | victory | gameover
    this.tick = 0; // fixed-step sim ticks since the run began
    this.time = 0; // seconds of sim time

    // Economy and run.
    this.gold = 280; // opening purse: three towers, so wave 1 is a fight, not a leak
    this.lives = 20;
    this.maxLives = 25;
    this.score = 0;
    this.wave = 0; // wave in progress (0 = none started yet)
    this.waveState = 'idle'; // idle | spawning | fighting | done
    this.kills = 0;
    this.leaks = 0;
    this.earned = 0; // total gold earned from kills and bonuses

    // The ridge.
    this.nodes = BUILD_NODES.map((n) => ({ ...n, tower: null }));
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floaters = []; // floating "+6" gold texts
    this.spawnQueue = [];
    this.spawnTimer = 0;

    // The wind, the vanes that steer it locally, and the permanent
    // modifiers blessings have granted. The wind model reads the vanes,
    // so every local-wind question goes through wind.localWindAt.
    this.wind = new WindModel();
    this.vanes = new WindVanes();
    this.wind.vanes = this.vanes;
    this.spawnCounter = 0; // every spawned enemy's index: wobble phases stay seeded
    this.mods = {
      range: 0,
      damage: 0,
      projectileSpeed: 0,
      chain: 0,
      reward: 0,
      rate: 0,
      windCatch: 0,
    };

    // Blessing choice on screen (null when no choice is open).
    this.blessingOffer = null;
    this.blessingsTaken = [];

    // UI selection: {kind:'node', id} | {kind:'tower', id} | {kind:'build', type} | null
    this.selection = null;
    this.buildType = 'archer'; // tower type the 1-5 keys / build menu picks
    this.speed = 1; // 1x or 2x
    this.paused = false;
    this.muted = false;
    this.shake = 0; // screen-shake magnitude, decays every tick
    this.message = ''; // banner line under the HUD ("Wave 7 — the wind turns NW")
    this.messageUntil = 0;
    this.stats = { shots: 0, hits: 0 };
    this.hover = { x: -1, y: -1 }; // last pointer position, in board pixels
  }

  get alive() {
    return this.phase === 'playing' || this.phase === 'blessing';
  }

  get waveLabel() {
    if (this.wave === 0) return '—/20';
    if (this.wave > TOTAL_WAVES) return `∞ ${this.wave}`;
    return `${this.wave}/20`;
  }

  towerAt(nodeId) {
    const node = this.nodes[nodeId];
    return node ? node.tower : null;
  }

  towers() {
    const out = [];
    for (const node of this.nodes) if (node.tower) out.push(node.tower);
    return out;
  }

  // Auras: every Beacon's buff, summed per tower in range.
  buffsFor(node) {
    const buffs = { damage: 0, range: 0 };
    for (const other of this.towers()) {
      if (other.def.id !== 'beacon') continue;
      const d = Math.hypot(other.x - node.x, other.y - node.y);
      if (d <= other.def.range * (1 + (other.level - 1) * 0.25)) {
        buffs.damage += other.def.buffDamage;
        buffs.range += other.def.buffRange;
      }
    }
    return buffs;
  }

  banner(text, seconds = 3) {
    this.message = text;
    this.messageUntil = this.time + seconds;
  }
}
