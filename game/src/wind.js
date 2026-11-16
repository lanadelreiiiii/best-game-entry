// KITEWARDEN — the wind model. Every wave rolls a new wind: a direction
// (one of eight compass headings) and a strength from a breeze to a gale.
// The wind is the game's signature mechanic: it bends every projectile in
// flight, and a tower shooting downwind reaches farther than one shooting
// into it, so where you build matters as much as what you build.
//
// On top of the global wind sit the wind vanes (see vanes.js): three
// player-turnable masts whose rings bend the LOCAL wind toward the
// direction the player chose. Outside every ring the wind is exactly the
// global wind; inside a ring it is a blend, strongest at the mast and
// fading to nothing at the ring's edge. Combat asks this model for the
// wind at a point — never for the global wind alone — so a turned vane
// genuinely re-aims the shots that fly through its ring.

import { WIND_HEADINGS } from './vanes.js';

export class WindModel {
  constructor() {
    this.angle = 0; // radians; 0 = blowing east (left to right)
    this.strength = 0.3; // 0 = calm, 1 = gale
    this.label = 'E';
    this.gust = 0; // slow oscillation, -1..1, so the wind feels alive
    this.vanes = null; // WindVanes, wired in by GameState; null = no vanes yet
  }

  // Roll a new wind for a wave. Direction and strength come from the wave's
  // seeded generator, so the same seed always blows the same wind.
  rollForWave(wave, rng) {
    const pick = WIND_HEADINGS[Math.floor(rng() * WIND_HEADINGS.length)];
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

  // The wind at a point on the board: the global wind, blended toward
  // the nearest covering vane's direction inside a vane ring. Returns
  // { angle, strength, blend, vane } — blend is 0 outside every ring.
  localWindAt(x, y) {
    const strength = this.effectiveStrength();
    if (!this.vanes) return { angle: this.angle, strength, blend: 0, vane: null };
    const hit = this.vanes.covering(x, y);
    if (!hit) return { angle: this.angle, strength, blend: 0, vane: null };
    const mix = 0.65 * hit.falloff; // vanes.js VANE_BLEND, strongest at the mast
    const vx = Math.cos(this.vanes.angleOf(hit.vane));
    const vy = Math.sin(this.vanes.angleOf(hit.vane));
    const lx = Math.cos(this.angle) * (1 - mix) + vx * mix;
    const ly = Math.sin(this.angle) * (1 - mix) + vy * mix;
    return { angle: Math.atan2(ly, lx), strength, blend: mix, vane: hit.vane };
  }

  // How much the wind bends a shot: lateral acceleration applied to a
  // projectile each tick, scaled by strength and by the projectile's
  // wind-catching factor (kites catch more wind than rods).
  bendPerTick(windCatch) {
    return this.strength * windCatch;
  }

  // Downwind range bonus for a shot heading `shotAngle` under a wind
  // blowing at `windAngle` with `windStrength`: a tower whose shot flies
  // with the wind (within 60 degrees of it) gains up to +25% range;
  // shooting into the wind loses up to 10%.
  rangeBonusFor(shotAngle, windAngle, windStrength) {
    const diff = Math.abs(((shotAngle - windAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const aligned = Math.max(0, Math.cos(diff)); // 1 = dead downwind, 0 = crosswind
    const headwind = diff > Math.PI / 2 ? (Math.cos(diff) + 1) / 2 : 0;
    return 1 + aligned * 0.25 * windStrength - headwind * 0.1 * windStrength;
  }

  // Range bonus under the global wind (a shot far from every vane).
  rangeMultiplier(shotAngle) {
    return this.rangeBonusFor(shotAngle, this.angle, this.effectiveStrength());
  }

  // Range bonus for a shot whose flight passes through point (x, y):
  // the local wind there — vane-blended if inside a ring — decides it.
  rangeMultiplierAt(shotAngle, x, y) {
    const local = this.localWindAt(x, y);
    return this.rangeBonusFor(shotAngle, local.angle, local.strength);
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
