// KITEWARDEN — the wind model. Every wave rolls a new wind: a direction
// (one of eight compass headings) and a strength from a breeze to a gale.
// The wind is the game's signature mechanic: it bends every projectile in
// flight, and a tower shooting downwind reaches farther than one shooting
// into it, so where you build matters as much as what you build.

export class WindModel {
  constructor() {
    this.angle = 0; // radians; 0 = blowing east (left to right)
    this.strength = 0.3; // 0 = calm, 1 = gale
    this.label = 'E';
    this.gust = 0; // slow oscillation, -1..1, so the wind feels alive
  }

  // Roll a new wind for a wave. Direction and strength come from the wave's
  // seeded generator, so the same seed always blows the same wind.
  rollForWave(wave, rng) {
    const headings = [
      { angle: 0, label: 'E' },
      { angle: Math.PI / 4, label: 'SE' },
      { angle: Math.PI / 2, label: 'S' },
      { angle: (3 * Math.PI) / 4, label: 'SW' },
      { angle: Math.PI, label: 'W' },
      { angle: (-3 * Math.PI) / 4, label: 'NW' },
      { angle: -Math.PI / 2, label: 'N' },
      { angle: -Math.PI / 4, label: 'NE' },
    ];
    const pick = headings[Math.floor(rng() * headings.length)];
    this.angle = pick.angle;
    this.label = pick.label;
    // Later waves blow harder on average; wave 1 is always a gentle breeze.
    const base = 0.25 + Math.min(0.55, wave * 0.03);
    this.strength = Math.min(0.95, base + rng() * 0.25);
  }

  // Unit vector the wind blows toward.
  vector() {
    return { x: Math.cos(this.angle), y: Math.sin(this.angle) };
  }

  // How much the wind bends a shot: lateral acceleration applied to a
  // projectile each tick, scaled by strength and by the projectile's
  // wind-catching factor (kites catch more wind than rods).
  bendPerTick(windCatch) {
    return this.strength * windCatch;
  }

  // Downwind range bonus: a tower whose shot flies with the wind (within
  // 60 degrees of it) gains up to +25% range; shooting into the wind loses
  // up to 10%. Returns a multiplier for a shot heading `shotAngle`.
  rangeMultiplier(shotAngle) {
    const diff = Math.abs(((shotAngle - this.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const aligned = Math.max(0, Math.cos(diff)); // 1 = dead downwind, 0 = crosswind
    const headwind = diff > Math.PI / 2 ? (Math.cos(diff) + 1) / 2 : 0;
    return 1 + aligned * 0.25 * this.strength - headwind * 0.1 * this.strength;
  }

  // Advance the gust oscillation one tick (called by the fixed-step sim).
  tick(tick) {
    this.gust = Math.sin(tick * 0.008) * 0.5 + Math.sin(tick * 0.021) * 0.5;
  }

  // Current effective strength including the gust, for display and audio.
  effectiveStrength() {
    return Math.max(0.05, Math.min(1, this.strength + this.gust * 0.08));
  }
}
