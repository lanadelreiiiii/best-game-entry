// KITEWARDEN — the ridge: the serpentine path enemies walk, and the build
// nodes where kite towers stand.
//
// From wave 3 the path FORKS. The trunk runs from the west gate to the
// mid-map fork node at (900, 360); there the storm splits into two lanes
// that converge again at the base:
//
//   RIDGE lane (the high road): the old middle run west along y=360, down
//     the west drop, then east along the bottom run to the east gate.
//   VALLEY lane (the low road): south from the fork to y=540, west along
//     the valley floor, then down to the bottom run and east to the gate.
//
// Both lanes are exactly the same length (1,674 px past the fork, 2,828 px
// in all), so an enemy's distance-travelled means the same thing on either
// lane: towers still target "furthest along", and neither lane is a
// shortcut. The split itself is seeded per wave (see waves.js), and the
// Scout Kite re-decides at the fork, taking the lane with fewer towers
// watching it (see combat.js).

export const RIDGE_PATH = [
  { x: -24, y: 130 },
  { x: 900, y: 130 },
  { x: 900, y: 360 },
  { x: 380, y: 360 },
  { x: 380, y: 590 },
  { x: 1304, y: 590 },
];

// The valley lane's full path, west gate to east gate.
export const VALLEY_PATH = [
  { x: -24, y: 130 },
  { x: 900, y: 130 },
  { x: 900, y: 360 },
  { x: 900, y: 540 },
  { x: 380, y: 540 },
  { x: 380, y: 590 },
  { x: 1304, y: 590 },
];

// The shared trunk: west gate to the fork. Every enemy walks this before
// choosing a lane, so the fork is one decision point, not two paths.
export const TRUNK_PATH = RIDGE_PATH.slice(0, 3);

// The lanes past the fork, as polylines of their own (the bottom run is
// shared, so both lanes end where they merge back into it at (380, 590)).
export const RIDGE_LANE = RIDGE_PATH.slice(2);
export const VALLEY_LANE = [
  { x: 900, y: 360 },
  { x: 900, y: 540 },
  { x: 380, y: 540 },
  { x: 380, y: 590 },
];

export const LANES = { ridge: RIDGE_PATH, valley: VALLEY_PATH };

export const FORK_POINT = { x: 900, y: 360 };
export const FORK_WAVE = 3; // the fork opens on wave 3; waves 1-2 are single-lane

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

// Length of one polyline, in pixels.
export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

// Distance from the west gate to the fork node, along the trunk.
export const FORK_DIST = pathLength(TRUNK_PATH); // 1154

// Total length of the ridge path, in pixels. Used for enemy progress.
// Both lanes are the same length, so this is the length of either lane.
export function ridgeLength() {
  return pathLength(RIDGE_PATH);
}

export function valleyLength() {
  return pathLength(VALLEY_PATH);
}

// Position (and heading) of a point `dist` pixels along one polyline.
export function pointOn(points, dist) {
  let remaining = Math.max(0, dist);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
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
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return { x: last.x, y: last.y, angle: Math.atan2(last.y - prev.y, last.x - prev.x) };
}

// Position (and heading) of a point `dist` pixels along a lane's path:
// 'ridge' (the high road) or 'valley' (the low road). The trunk is shared,
// so the two lanes only diverge past FORK_DIST.
export function pointAlongPath(dist, lane = 'ridge') {
  return pointOn(LANES[lane] || RIDGE_PATH, dist);
}

// Distance from a point to the nearest point on one polyline.
export function distanceToPolyline(points, x, y) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
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

// Distance from a point to the nearest point on EITHER lane's path (for
// node scoring and terrain decoration: nothing spawns on either lane).
export function distanceToPath(x, y) {
  return Math.min(
    distanceToPolyline(RIDGE_PATH, x, y),
    distanceToPolyline(VALLEY_PATH, x, y),
  );
}

// Distance from a point to the nearest point on one lane PAST the fork
// (for the Scout Kite's choice: how close a tower stands to that lane).
export function distanceToLane(lane, x, y) {
  const points = lane === 'valley' ? VALLEY_LANE : RIDGE_LANE;
  return distanceToPolyline(points, x, y);
}
