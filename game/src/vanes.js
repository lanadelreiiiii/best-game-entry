// KITEWARDEN — wind vanes. Three kite-vanes stand in the open ground
// between the path's runs. Each one holds a compass direction, and the
// player can click it — free, any time, even mid-wave — to turn it 45
// degrees. Inside a vane's ring the local wind blends toward the vane's
// direction, so a player who turns the wind around a corner bends every
// shot that flies through the ring. At the start of each wave every vane
// points along that wave's rolled wind, so the board always starts fair
// and the player chooses where to diverge from it.
//
// Vane spots were picked off the path and off the build nodes on purpose:
// every spot is more than 60px from any path segment and more than 70px
// from the nearest build node, one in each band of the map (top, middle,
// bottom), so each vane guards a different stretch of the ridge. The
// middle vane sits between the Ridge and Valley lanes, where the fork
// splits — its ring covers both lanes, so one turn bends shots over
// either road.

export const VANE_RADIUS = 170; // influence ring, in pixels
export const VANE_BLEND = 0.65; // how far the local wind leans to the vane at its centre
export const VANE_CLICK_RADIUS = 36; // hit-test radius for mouse/touch

// The eight compass headings, in clockwise order from east. A vane's
// heading is an index into this list; rotating is +1, wrapping at 8.
export const WIND_HEADINGS = [
  { angle: 0, label: 'E' },
  { angle: Math.PI / 4, label: 'SE' },
  { angle: Math.PI / 2, label: 'S' },
  { angle: (3 * Math.PI) / 4, label: 'SW' },
  { angle: Math.PI, label: 'W' },
  { angle: (-3 * Math.PI) / 4, label: 'NW' },
  { angle: -Math.PI / 2, label: 'N' },
  { angle: -Math.PI / 4, label: 'NE' },
];

export const VANE_SPOTS = [
  { x: 330, y: 245 }, // top band: between the top and middle runs, over nodes 0-1
  { x: 780, y: 465 }, // middle band: between the Ridge and Valley lanes, east of node 4
  { x: 430, y: 665 }, // bottom band: under the bottom run, guarding the east gate road
];

// Index of the heading whose angle matches `angle` (angles are always
// exact eighths of a turn in this game, so a nearest match is exact).
export function headingIndexFor(angle) {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < WIND_HEADINGS.length; i++) {
    let diff = Math.abs(angle - WIND_HEADINGS[i].angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

export class WindVanes {
  constructor() {
    this.vanes = VANE_SPOTS.map((spot, i) => ({
      id: i,
      x: spot.x,
      y: spot.y,
      radius: VANE_RADIUS,
      heading: 0, // index into WIND_HEADINGS; east until a wave sets it
      pulseUntil: 0, // sim time the toggle pulse ring stays visible until
    }));
  }

  all() {
    return this.vanes;
  }

  at(id) {
    return this.vanes[id] || null;
  }

  // A vane's compass label, e.g. 'SE'.
  labelOf(vane) {
    return WIND_HEADINGS[vane.heading].label;
  }

  // A vane's direction as radians.
  angleOf(vane) {
    return WIND_HEADINGS[vane.heading].angle;
  }

  // Wave start: every vane turns to face the wave's rolled wind.
  syncToWind(windAngle) {
    const heading = headingIndexFor(windAngle);
    for (const vane of this.vanes) vane.heading = heading;
  }

  // Turn one vane 45 degrees clockwise. Free, and legal mid-wave.
  // Returns the vane's new label, or null for a bad id. `now` is the
  // sim time, so the pulse ring is deterministic, not wall-clock.
  rotate(id, now) {
    const vane = this.at(id);
    if (!vane) return null;
    vane.heading = (vane.heading + 1) % WIND_HEADINGS.length;
    vane.pulseUntil = now + 3; // the pulse ring lives three sim seconds
    return this.labelOf(vane);
  }

  // The vane (if any) whose ring covers point (x, y), with the strongest
  // pull there. Rings never overlap on this board, so at most one wins.
  covering(x, y) {
    let best = null;
    let bestFalloff = 0;
    for (const vane of this.vanes) {
      const d = Math.hypot(x - vane.x, y - vane.y);
      if (d >= vane.radius) continue;
      const falloff = 1 - d / vane.radius; // 1 at the mast, 0 at the ring edge
      if (falloff > bestFalloff) {
        bestFalloff = falloff;
        best = vane;
      }
    }
    return best ? { vane: best, falloff: bestFalloff } : null;
  }

  // How strongly the vane at (x, y) pulls the wind: 0 outside every
  // ring, up to VANE_BLEND at a mast.
  pullAt(x, y) {
    const hit = this.covering(x, y);
    return hit ? VANE_BLEND * hit.falloff : 0;
  }
}
