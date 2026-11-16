// KITEWARDEN — the ridge: the serpentine path enemies walk, and the build
// nodes where kite towers stand. The path is one polyline from the west gate
// to the east gate; every enemy follows it waypoint by waypoint, and every
// tower is built on a node in the pockets between its runs.

export const RIDGE_PATH = [
  { x: -24, y: 130 },
  { x: 900, y: 130 },
  { x: 900, y: 360 },
  { x: 380, y: 360 },
  { x: 380, y: 590 },
  { x: 1304, y: 590 },
];

// Eight build nodes in the pockets between the path's runs. Each node holds
// at most one tower; a tower's range decides which runs it can cover.
export const BUILD_NODES = [
  { id: 0, x: 170, y: 245 },
  { id: 1, x: 560, y: 245 },
  { id: 2, x: 1075, y: 245 },
  { id: 3, x: 1075, y: 465 },
  { id: 4, x: 640, y: 465 },
  { id: 5, x: 180, y: 465 },
  { id: 6, x: 700, y: 665 },
  { id: 7, x: 1050, y: 665 },
];

export const PATH_WIDTH = 34;
export const NODE_RADIUS = 26;

// Total length of the ridge path, in pixels. Used for enemy progress.
export function ridgeLength() {
  let total = 0;
  for (let i = 1; i < RIDGE_PATH.length; i++) {
    const dx = RIDGE_PATH[i].x - RIDGE_PATH[i - 1].x;
    const dy = RIDGE_PATH[i].y - RIDGE_PATH[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

// Position (and heading) of a point `dist` pixels along the path.
export function pointAlongPath(dist) {
  let remaining = Math.max(0, dist);
  for (let i = 1; i < RIDGE_PATH.length; i++) {
    const a = RIDGE_PATH[i - 1];
    const b = RIDGE_PATH[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    remaining -= seg;
  }
  const last = RIDGE_PATH[RIDGE_PATH.length - 1];
  const prev = RIDGE_PATH[RIDGE_PATH.length - 2];
  return { x: last.x, y: last.y, angle: Math.atan2(last.y - prev.y, last.x - prev.x) };
}

// Distance from a point to the nearest point on the path (for node scoring).
export function distanceToPath(x, y) {
  let best = Infinity;
  for (let i = 1; i < RIDGE_PATH.length; i++) {
    const a = RIDGE_PATH[i - 1];
    const b = RIDGE_PATH[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}
