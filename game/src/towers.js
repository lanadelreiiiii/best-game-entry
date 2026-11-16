// KITEWARDEN — the five kite towers. Each tower is one clear job: the
// Archer is cheap and fast, the Fan shoves enemies back with the wind, the
// Rod calls lightning, the Snare slows the pack, and the Beacon makes its
// neighbours stronger. Every tower upgrades twice; each level multiplies its
// stats and changes its kite's look.

export const TOWERS = {
  archer: {
    id: 'archer',
    name: 'Kite Archer',
    blurb: 'Cheap, fast shots. The backbone of the ridge.',
    cost: 50,
    range: 150,
    damage: 16,
    rate: 1.8, // shots per second
    projectileSpeed: 420,
    windCatch: 0.55, // how much the wind bends its shots
    color: '#ff8c42',
    dark: '#c85a17',
    shape: 'diamond',
  },
  fan: {
    id: 'fan',
    name: 'Gale Fan',
    blurb: 'Shoves enemies back — harder when the wind is with it.',
    cost: 80,
    range: 120,
    damage: 8,
    rate: 0.9,
    projectileSpeed: 300,
    windCatch: 0.9,
    knockback: 30, // pixels shoved back along the wind, per hit
    color: '#5ec8c0',
    dark: '#2e8f88',
    shape: 'fan',
  },
  rod: {
    id: 'rod',
    name: 'Storm Rod',
    blurb: 'Slow lightning that chains to nearby enemies.',
    cost: 120,
    range: 175,
    damage: 30,
    rate: 0.5,
    projectileSpeed: 900, // near-instant lightning
    windCatch: 0.05, // lightning barely notices the wind
    chain: 2, // extra enemies zapped per shot
    color: '#ffd94d',
    dark: '#b8912a',
    shape: 'rod',
  },
  snare: {
    id: 'snare',
    name: 'Snare Kite',
    blurb: 'Sticky shots that slow the pack so others can finish it.',
    cost: 70,
    range: 140,
    damage: 6,
    rate: 1.1,
    projectileSpeed: 360,
    windCatch: 0.7,
    slowFactor: 0.55, // enemy speed multiplier while snared
    slowTime: 1.6, // seconds
    color: '#b48ce8',
    dark: '#7a55b0',
    shape: 'hex',
  },
  beacon: {
    id: 'beacon',
    name: 'Beacon',
    blurb: 'No attack — nearby towers hit harder and reach farther.',
    cost: 100,
    range: 240, // aura radius: wide enough to reach the neighbouring nodes
    damage: 0,
    rate: 0,
    projectileSpeed: 0,
    windCatch: 0,
    buffDamage: 0.3, // +30% damage to towers in the aura
    buffRange: 0.15, // +15% range to towers in the aura
    color: '#f2ead8',
    dark: '#a89a7c',
    shape: 'beacon',
  },
};

export const TOWER_ORDER = ['archer', 'fan', 'rod', 'snare', 'beacon'];

// Upgrade multipliers per level (level 1 is the base stats above).
export const TOWER_LEVELS = [
  null,
  { mult: 1, cost: 0, label: 'Lv 1' },
  { mult: 1.6, cost: 0.6, label: 'Lv 2' }, // upgrade cost = 60% of base cost
  { mult: 2.4, cost: 1.1, label: 'Lv 3' }, // upgrade cost = 110% of base cost
];

export const MAX_TOWER_LEVEL = 3;
export const SELL_REFUND = 0.7; // 70% of everything invested, back

// Stats of one tower instance, after its level and every Beacon aura that
// reaches it. Pure function of (definition, level, buffs) — no hidden state.
export function towerStats(def, level, buffs) {
  const lv = TOWER_LEVELS[level] || TOWER_LEVELS[1];
  const dmgBuff = 1 + (buffs.damage || 0);
  const rangeBuff = 1 + (buffs.range || 0);
  return {
    damage: def.damage * lv.mult * dmgBuff,
    range: def.range * (1 + (lv.mult - 1) * 0.25) * rangeBuff,
    rate: def.rate * (1 + (lv.mult - 1) * 0.2),
    knockback: (def.knockback || 0) * lv.mult,
    chain: def.chain || 0,
    slowFactor: def.slowFactor || 0,
    slowTime: def.slowTime || 0,
  };
}

// Gold to upgrade from `level` to `level + 1`, or null at max level.
export function upgradeCost(def, level) {
  if (level >= MAX_TOWER_LEVEL) return null;
  return Math.round(def.cost * TOWER_LEVELS[level + 1].cost);
}
