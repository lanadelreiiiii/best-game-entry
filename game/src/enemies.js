// KITEWARDEN — the six storm creatures that walk the ridge. Each one is
// a different problem: the Wisp is fast and fragile, the Drifter soaks
// damage, the Gustling ignores shoves, the Shearling splits in two when it
// dies, the Mender heals the pack around it — kill it first — and the Storm
// Serpent, the boss of every fifth wave, is all of them at once, bigger.

export const ENEMIES = {
  wisp: {
    id: 'wisp',
    name: 'Wisp',
    blurb: 'Fast, fragile, always first through the gate.',
    hp: 26,
    speed: 70, // pixels per second along the path
    reward: 6, // gold on kill
    lives: 1, // lives lost if it reaches the east gate
    radius: 13,
    color: '#cfe8ff',
    dark: '#7fb2e0',
    shape: 'wisp',
  },
  drifter: {
    id: 'drifter',
    name: 'Drifter',
    blurb: 'Slow, heavy, and very hard to bring down.',
    hp: 120,
    speed: 40,
    reward: 12,
    lives: 1,
    radius: 19,
    color: '#8fa3b8',
    dark: '#54657a',
    shape: 'drifter',
  },
  gustling: {
    id: 'gustling',
    name: 'Gustling',
    blurb: 'Spiked and stubborn — no wind can shove it back.',
    hp: 65,
    speed: 56,
    reward: 10,
    lives: 1,
    radius: 15,
    color: '#7fe0a8',
    dark: '#3f9e68',
    shape: 'gustling',
    knockbackImmune: true,
  },
  shearling: {
    id: 'shearling',
    name: 'Shearling',
    blurb: 'Cut it down and it comes apart into two wisps.',
    hp: 80,
    speed: 52,
    reward: 14,
    lives: 2,
    radius: 16,
    color: '#e8a7d0',
    dark: '#b06a94',
    shape: 'shearling',
    splitsInto: 'wisp',
    splitCount: 2,
  },
  mender: {
    id: 'mender',
    name: 'Storm Mender',
    blurb: 'Mends the pack around it — kill it first, or the wave out-heals you.',
    hp: 70,
    speed: 48,
    reward: 16,
    lives: 1,
    radius: 14,
    color: '#8be07f',
    dark: '#4a9e3f',
    shape: 'mender',
    healRate: 6, // hp per second it restores to each nearby ally
    healRadius: 95,
  },
  serpent: {
    id: 'serpent',
    name: 'Storm Serpent',
    blurb: 'The boss. It coils across the ridge and does not hurry.',
    hp: 1200,
    speed: 30,
    reward: 150,
    lives: 5,
    radius: 30,
    color: '#ffd94d',
    dark: '#8a6d1f',
    shape: 'serpent',
    boss: true,
  },
};

// Health scales with the wave so the same creature stays dangerous later.
// Bosses scale slower than the pack, so wave 20 stays winnable.
export function scaledHp(def, wave) {
  const growth = def.boss ? 0.1 : 0.18;
  return Math.round(def.hp * (1 + (wave - 1) * growth));
}

export function scaledReward(def, wave) {
  return def.reward + Math.floor(wave / 5);
}
