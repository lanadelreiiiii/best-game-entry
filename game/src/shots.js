// KITEWARDEN — staged screenshots. `?shot=<name>&seed=<n>` drives the real
// game into an exact scene: towers are placed with the real build action,
// waves are started with the real wave action, and the sim is stepped with
// the real fixed-step loop. Nothing here draws anything by hand — every
// pixel in a screenshot is a frame the game itself rendered.
//
//   start  — the title screen over the ridge, wind streaks drifting
//   play   — wave 10, the boss wave: the Storm Serpent and its escort
//             spread along the top run, seven towers firing, the Mender
//             healing the pack
//   choice — the blessing offer after wave 5, three cards to pick from
//   end    — the victory screen after wave 20, the Serpent defeated

import { TOTAL_WAVES, drawBlessings } from './waves.js';

const STEP = 1 / 60;

// Towers for a staged mid-run ridge: one of each kind plus a second
// Archer on the lower run, the Archer and the Rod already upgraded, the
// Beacon placed to buff its neighbours.
const STAGED_TOWERS = [
  { node: 0, type: 'archer', upgrades: 1 },
  { node: 1, type: 'fan', upgrades: 0 },
  { node: 2, type: 'rod', upgrades: 1 },
  { node: 3, type: 'ember', upgrades: 0 },
  { node: 4, type: 'snare', upgrades: 1 },
  { node: 5, type: 'beacon', upgrades: 0 },
  { node: 6, type: 'archer', upgrades: 0 },
];

function placeStagedTowers(game) {
  const s = game.state;
  s.gold = 900; // staging purse: the towers are bought with the real action
  for (const t of STAGED_TOWERS) {
    if (game.buildAt(t.node, t.type)) {
      for (let i = 0; i < t.upgrades; i++) game.upgradeSelected();
      game.clearSelection();
    }
  }
}

// Step the sim until the current wave clears, the run ends, or the cap is
// hit. If a wave drags, the remaining enemies are finished with the real
// damage function, which is what lets the wave complete honestly.
function finishWave(game, capTicks = 12000) {
  const s = game.state;
  let ticks = 0;
  while (s.phase === 'playing' && s.waveState !== 'done' && s.waveState !== 'idle' && ticks < capTicks) {
    game.stepSim(STEP);
    ticks++;
    if (s.phase === 'blessing' || s.phase === 'victory' || s.phase === 'gameover') break;
  }
  let passes = 0;
  while (
    s.phase === 'playing' &&
    (s.waveState === 'spawning' || s.waveState === 'fighting') &&
    passes < 4
  ) {
    for (const e of s.enemies.slice()) game.combat.damage(e, 1e9, null);
    for (let i = 0; i < 30; i++) game.stepSim(STEP);
    passes++;
  }
}

// Play real waves until the run reaches `targetWave` (started, not cleared).
// A lost run fails loudly here: staging must never resurrect a dead run
// and photograph its second life.
function playThrough(game, targetWave) {
  const s = game.state;
  let guard = 0;
  while (s.wave < targetWave && guard < 120000) {
    guard++;
    if (s.phase === 'gameover') {
      throw new Error(`staging lost the run on wave ${s.wave} (lives 0)`);
    }
    if (s.phase === 'blessing') {
      game.chooseBlessing(0);
      continue;
    }
    if (s.phase !== 'playing') break;
    if (s.waveState === 'idle' || s.waveState === 'done') {
      if (!game.startWave()) break;
      continue;
    }
    finishWave(game);
  }
}

export function stageShot(game, name, seed) {
  game.reset(seed);
  const s = game.state;
  s.phase = 'playing';
  s.audio = null; // staged runs are silent: no AudioContext in screenshots

  if (name === 'start') {
    s.phase = 'title';
    s.wind.rollForWave(1, s.rng);
    return;
  }

  placeStagedTowers(game);

  if (name === 'play') {
    playThrough(game, 10);
    // Wave 10, the boss wave, about twenty-three seconds in: the Serpent
    // is well onto the top run behind its escort, the pack is spread along
    // the top run and turning the corner, and towers all along the ridge
    // are firing. The wave cannot end this early — the Serpent takes
    // ~25 seconds of focused fire to bring down.
    for (let i = 0; i < 1400 && s.phase === 'playing'; i++) game.stepSim(STEP);
    s.banner(`Wave 10 — the Storm Serpent comes, and the kites bend with it.`, 30);
    return;
  }

  if (name === 'choice') {
    playThrough(game, 5);
    finishWave(game);
    // completeWave opens the blessing offer itself after wave 5; this is
    // only a safety net in case the wave ended on the force-clear path.
    if (s.phase === 'playing' && s.waveState === 'done' && s.wave % 5 === 0) {
      s.phase = 'blessing';
      s.blessingOffer = drawBlessings(s.rng);
    }
    return;
  }

  if (name === 'end') {
    // Wave 20, the last one: the Serpent and its escort, finished with the
    // real damage path so the victory screen is reached for real.
    s.wave = TOTAL_WAVES - 1;
    s.waveState = 'idle';
    game.startWave();
    let guard = 0;
    while (s.phase === 'playing' && guard < 6000) {
      game.stepSim(STEP);
      for (const e of s.enemies.slice()) game.combat.damage(e, 1e9, null);
      guard++;
      if (s.phase === 'victory') break;
    }
    return;
  }

  // Unknown shot name: fall back to the title screen.
  s.phase = 'title';
}
