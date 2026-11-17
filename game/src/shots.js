// KITEWARDEN — staged screenshots. `?shot=<name>&seed=<n>` drives the real
// game into an exact scene: towers are placed with the real build action,
// vanes are turned with the real rotate action, waves are started with the
// real wave action, and the sim is stepped with the real fixed-step loop.
// Nothing here draws anything by hand — every pixel in a screenshot is a
// frame the game itself rendered.
//
//   start  — the title screen over the ridge, wind streaks drifting, the
//             three vanes pointing three different ways under the design
//             note that names the mechanic
//   play   — wave 6 at the fork: the storm splits across the Ridge and
//             Valley lanes (both lanes full of enemies, the fork signpost
//             between them), a northerly gale, the top vane turned east
//             so shots bend visibly sideways through its ring
//   vane   — wave 7 mid-fight, the middle vane just turned to SE: the
//             pulse ring still expanding, "TURNED SE" over its ring
//   end    — the victory screen after wave 20, the Serpent defeated

import { TOTAL_WAVES, drawBlessings } from './waves.js';
import { FORK_DIST } from './ridge.js';

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

// Turn a vane to a named heading through the real rotate action, one
// 45-degree click at a time. At most eight clicks; the loop always ends.
function turnVaneTo(game, id, label) {
  const s = game.state;
  for (let i = 0; i < 8; i++) {
    if (s.vanes.labelOf(s.vanes.at(id)) === label) return;
    game.rotateVane(id);
  }
}

// A rotate throws particles and a floater. On the title screen the sim
// never steps, so anything thrown there would freeze mid-air in the
// still — sweep them away after staging the cover's vanes.
function sweepEffects(game) {
  const s = game.state;
  s.particles = [];
  s.floaters = [];
  for (const p of game.combat.particlePool) p.active = false;
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

// How many live enemies are past the fork on each lane right now.
function lanesPastFork(state) {
  let ridge = 0;
  let valley = 0;
  for (const e of state.enemies) {
    if (e.dist <= FORK_DIST) continue;
    if (e.lane === 'valley') valley++;
    else ridge++;
  }
  return { ridge, valley };
}

export function stageShot(game, name, seed) {
  game.reset(seed);
  const s = game.state;
  s.phase = 'playing';
  s.audio = null; // staged runs are silent: no AudioContext in screenshots

  if (name === 'start') {
    s.wind.rollForWave(1, s.rng);
    s.vanes.syncToWind(s.wind.angle);
    // The cover shows the mechanic at a glance: three vanes, three
    // different headings, under the design note that names them.
    turnVaneTo(game, 0, 'NE');
    turnVaneTo(game, 1, 'S');
    turnVaneTo(game, 2, 'W');
    sweepEffects(game);
    s.phase = 'title';
    return;
  }

  placeStagedTowers(game);

  if (name === 'play') {
    // The fork shot: wave 6, stepped until the storm is visibly split —
    // at least two enemies past the fork on EACH lane — so the still
    // shows the Ridge lane and the Valley lane both full, the fork
    // signpost between them, and a Scout Kite somewhere in the pack.
    // Wave 6 is past the fork's opening (wave 3) and has scouts in it.
    playThrough(game, 6);
    let waited = 0;
    let split = lanesPastFork(s);
    while (
      s.phase === 'playing' &&
      (split.ridge < 2 || split.valley < 2) &&
      waited < 3600
    ) {
      game.stepSim(STEP);
      waited++;
      split = lanesPastFork(s);
    }
    // The bending shot: a northerly gale, and the top vane turned east.
    // Shots from the ridge towers toward the top run cross the vane's
    // ring and curve east, away from the global wind — the mechanic,
    // visible in the trails.
    s.wind.angle = -Math.PI / 2;
    s.wind.label = 'N';
    s.wind.strength = 0.95;
    turnVaneTo(game, 0, 'E');
    turnVaneTo(game, 1, 'S');
    turnVaneTo(game, 2, 'W');
    for (let i = 0; i < 120 && s.phase === 'playing'; i++) game.stepSim(STEP);
    const fork = s.forkSplit;
    const splitText = fork
      ? `Wave 6 splits Ridge ${fork.ridgePct}% / Valley ${100 - fork.ridgePct}% — the fork is open, scouts take the emptier lane.`
      : `Wave 6 — the path forks at the signpost: Ridge and Valley lanes.`;
    s.banner(splitText, 30);
    return;
  }

  if (name === 'vane') {
    playThrough(game, 7);
    for (let i = 0; i < 600 && s.phase === 'playing'; i++) game.stepSim(STEP);
    // The toggle moment, mid-fight: a westerly gale, and the middle vane
    // just turned to SE through the real rotate action. The pulse ring
    // is held open for the still, so the turn reads in one frame.
    s.wind.angle = Math.PI;
    s.wind.label = 'W';
    s.wind.strength = 0.9;
    turnVaneTo(game, 1, 'SE');
    s.vanes.at(1).pulseUntil = s.time + 30;
    for (let i = 0; i < 30 && s.phase === 'playing'; i++) game.stepSim(STEP);
    s.banner(`Vane turned SE — the wind inside its ring now blows SE. Free, anytime.`, 30);
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
