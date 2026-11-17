// KITEWARDEN — wave composition and gust blessings. Waves are built from
// the wave number and a seeded generator, so the same seed always sends the
// same storm. Every fifth wave ends in a Storm Serpent; every fifth cleared
// wave offers a choice of one blessing out of three.
//
// From wave 3 the path forks (see ridge.js): each wave's spawns split
// across the Ridge and Valley lanes, deterministically, with the split
// shown in the wave banner. The boss always walks the Ridge lane.

import { ENEMIES, scaledHp, scaledReward } from './enemies.js';
import { shuffleCopy } from './random.js';
import { FORK_WAVE } from './ridge.js';

export const TOTAL_WAVES = 20;

// One wave: a list of {type, delay, lane} spawns, in order, plus its boss
// flag and its fork split. From wave 3 the Ridge share is seeded per wave
// (35-65%), and every spawn rolls its lane against it — so the same seed
// always splits the same wave the same way, and the banner can name it.
export function buildWave(wave, rng) {
  const spawns = [];
  const count = 6 + Math.round(wave * 1.8);
  const fork = wave >= FORK_WAVE;
  const ridgeShare = fork ? 0.5 + (rng() - 0.5) * 0.3 : 1;
  let delay = 0;
  for (let i = 0; i < count; i++) {
    const roll = rng();
    let type = 'wisp';
    if (wave >= 3 && roll < 0.28) type = 'drifter';
    else if (wave >= 4 && roll < 0.46) type = 'gustling';
    else if (wave >= 5 && roll < 0.56) type = 'mender';
    else if (wave >= 6 && roll < 0.66) type = 'shearling';
    else if (wave >= 5 && roll < 0.74) type = 'scout';
    else if (wave >= 2 && roll < 0.8) type = 'drifter';
    // The lane is rolled per spawn, so the two lanes interleave instead of
    // one lane emptying before the other starts.
    const lane = !fork || rng() < ridgeShare ? 'ridge' : 'valley';
    spawns.push({ type, delay, lane });
    // Spawn gap shrinks as waves get harder: 0.8s early, 0.35s late.
    delay += Math.max(0.35, 0.8 - wave * 0.02) + rng() * 0.25;
  }
  if (wave % 5 === 0) {
    // The boss walks the Ridge lane, always — the fork never hides it.
    spawns.push({ type: 'serpent', delay: delay + 1.2, lane: 'ridge' });
  }
  const ridge = spawns.filter((s) => s.lane === 'ridge').length;
  const split = {
    ridge,
    valley: spawns.length - ridge,
    ridgePct: spawns.length === 0 ? 100 : Math.round((ridge / spawns.length) * 100),
  };
  return { wave, spawns, boss: wave % 5 === 0, duration: delay, fork, split };
}

// Gold for clearing a wave, before kill rewards.
export function waveClearBonus(wave) {
  return 30 + wave * 6;
}

// All nine blessings. Each one changes the game in exactly one way, and the
// choice is offered as 1-of-3 after every fifth cleared wave.
export const BLESSINGS = [
  {
    id: 'tailwind',
    name: 'Tailwind Charm',
    blurb: 'All towers reach 20% farther.',
    apply: (s) => { s.mods.range += 0.2; },
  },
  {
    id: 'silk',
    name: 'Kite Silk',
    blurb: 'All towers hit 25% harder.',
    apply: (s) => { s.mods.damage += 0.25; },
  },
  {
    id: 'purse',
    name: 'Storm Purse',
    blurb: 'Take 150 gold right now.',
    apply: (s) => { s.gold += 150; },
  },
  {
    id: 'sturdy',
    name: 'Sturdy String',
    blurb: 'Mend the ridge: +5 lives (max 25).',
    apply: (s) => { s.lives = Math.min(25, s.lives + 5); },
  },
  {
    id: 'boots',
    name: 'Gale Boots',
    blurb: 'Shots fly 15% faster — the wind bends them less.',
    apply: (s) => { s.mods.projectileSpeed += 0.15; },
  },
  {
    id: 'rod',
    name: 'Lightning Rod',
    blurb: 'Storm Rods chain to one more enemy.',
    apply: (s) => { s.mods.chain += 1; },
  },
  {
    id: 'pockets',
    name: 'Deep Pockets',
    blurb: 'Kills pay 25% more gold.',
    apply: (s) => { s.mods.reward += 0.25; },
  },
  {
    id: 'hands',
    name: 'Steady Hands',
    blurb: 'All towers fire 12% faster.',
    apply: (s) => { s.mods.rate += 0.12; },
  },
  {
    id: 'sense',
    name: 'Wind Sense',
    blurb: 'The wind bends shots half as much from now on.',
    apply: (s) => { s.mods.windCatch -= 0.5; },
  },
];

// Draw three distinct blessings for the choice screen.
export function drawBlessings(rng) {
  return shuffleCopy(rng, BLESSINGS).slice(0, 3);
}

// Build one live enemy from a spawn entry: hp/reward scaled to the wave.
// The wobble phase comes from the run's spawn counter, never Math.random:
// a staged screenshot with the same seed must play out identically.
// `lane` is the lane the enemy walks after the fork; a Scout Kite may
// re-decide at the fork itself (see combat.js).
export function spawnEnemy(type, wave, spawnIndex = 0, lane = 'ridge') {
  const def = ENEMIES[type];
  return {
    type,
    def,
    hp: scaledHp(def, wave),
    maxHp: scaledHp(def, wave),
    reward: scaledReward(def, wave),
    dist: 0, // pixels travelled along the ridge
    lane, // 'ridge' | 'valley' — which lane past the fork
    forked: false, // a Scout Kite sets this when it chooses its lane at the fork
    x: 0,
    y: 0,
    angle: 0,
    slowUntil: 0,
    slowFactor: 1,
    burnUntil: 0, // Ember Kite burn: time until the flames go out
    burnDps: 0, // damage per second while burning
    flash: 0, // hit-flash timer, for the renderer
    wobble: (spawnIndex * 2.39996) % (Math.PI * 2), // golden-angle spread
    dead: false,
    leaked: false,
  };
}
