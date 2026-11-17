// KITEWARDEN — automated playtest. Plays the real game like a player:
// title -> start -> select a node -> build an Archer with key 1 -> turn a
// wind vane twice with the mouse (free, and it rotates) -> start wave 1
// with Space -> let it run -> pause and resume -> restart. Asserts the
// wave actually starts, towers actually fire, vanes actually turn, and
// nothing throws. Then it checks the Forked Paths mechanic: both lanes
// exist and are equal length, waves split across them deterministically,
// the banner names the split, and a Scout Kite at the fork takes the
// less-defended lane. Exits non-zero on any failure. Writes one evidence
// screenshot to /tmp (never into screenshots/, which only holds staged
// shots).
//
//   node scripts/playtest.mjs [--port 8902]

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(
  '/home/hatch/workspace/web3-upgrade/repos/playwright-cli/node_modules/playwright-core/package.json',
);
const { chromium } = require('playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex === -1 ? 8902 : Number(args[portIndex + 1]);
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome';

function waitForPort(port, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      import('node:http').then(({ default: http }) => {
        const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => {
          res.resume();
          resolve();
        });
        req.on('error', () => {
          if (Date.now() - start > timeoutMs) reject(new Error('server did not come up'));
          else setTimeout(tryOnce, 200);
        });
      });
    };
    tryOnce();
  });
}

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

const server = spawn('node', ['serve.ts', '--port', String(port)], {
  cwd: repo,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => process.stderr.write(`[serve:err] ${d}`));

try {
  await waitForPort(port);
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  const readState = () =>
    page.evaluate(() => {
      const g = window.__kitewarden;
      if (!g) return null;
      const s = g.state;
      return {
        phase: s.phase,
        wave: s.wave,
        waveState: s.waveState,
        gold: s.gold,
        lives: s.lives,
        score: s.score,
        kills: s.kills,
        towers: s.towers().length,
        enemies: s.enemies.length,
        shots: s.stats.shots,
        paused: s.paused,
        speed: s.speed,
        vanes: s.vanes.all().map((v) => s.vanes.labelOf(v)),
      };
    });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(800);
  let st = await readState();
  check('game boots to title', st && st.phase === 'title', JSON.stringify(st));
  check('three wind vanes on the board', st && st.vanes && st.vanes.length === 3, JSON.stringify(st && st.vanes));

  // Click anywhere: title -> playing.
  await page.mouse.click(640, 600);
  await page.waitForTimeout(400);
  st = await readState();
  check('click starts the run', st && st.phase === 'playing', JSON.stringify(st));

  // Click node 0 (170, 245) to open the build menu, then press 1 to build.
  await page.mouse.click(170, 245);
  await page.waitForTimeout(300);
  st = await readState();
  check('node selected', st && st.phase === 'playing');
  await page.keyboard.press('1');
  await page.waitForTimeout(300);
  st = await readState();
  check('archer built with key 1', st && st.towers === 1 && st.gold === 230, JSON.stringify(st));

  // Build a second tower on node 1 with the mouse menu (click node, click
  // the Fan row). The menu opens right of the node: rows start at
  // (node.x + 40, node.y - 90), 52px tall; Fan is the second row.
  await page.mouse.click(560, 245);
  await page.waitForTimeout(300);
  await page.mouse.click(700, 230);
  await page.waitForTimeout(300);
  st = await readState();
  check('second tower built via menu', st && st.towers === 2 && st.gold === 150, JSON.stringify(st));

  // Wind vane: click vane 0 at (330, 245). Before any wave it points
  // east; one click turns it to SE, a second to S — and both are free.
  const goldBeforeVane = st.gold;
  const labelBefore = st.vanes[0];
  await page.mouse.click(330, 245);
  await page.waitForTimeout(300);
  st = await readState();
  check('vane click rotates it +45deg', st && st.vanes[0] !== labelBefore, JSON.stringify(st && st.vanes));
  check('vane toggle is free', st && st.gold === goldBeforeVane, JSON.stringify(st));
  const labelAfterOne = st.vanes[0];
  await page.mouse.click(330, 245);
  await page.waitForTimeout(300);
  st = await readState();
  check('second vane click rotates it again', st && st.vanes[0] !== labelAfterOne, JSON.stringify(st && st.vanes));

  // Space starts wave 1.
  await page.keyboard.press(' ');
  await page.waitForTimeout(500);
  st = await readState();
  check('wave 1 starts', st && st.wave === 1 && (st.waveState === 'spawning' || st.waveState === 'fighting'), JSON.stringify(st));

  // Let the wave run 8 seconds: towers must fire, enemies must walk.
  await page.waitForTimeout(8000);
  st = await readState();
  check('towers fired shots', st && st.shots > 0, JSON.stringify(st));
  check('enemies entered the ridge', st && (st.enemies > 0 || st.kills > 0), JSON.stringify(st));

  // Speed toggle, pause, resume.
  await page.keyboard.press('f');
  st = await readState();
  check('speed 2x toggles', st && st.speed === 2, JSON.stringify(st));
  await page.keyboard.press(' ');
  st = await readState();
  check('space pauses mid-wave', st && st.paused === true, JSON.stringify(st));
  await page.keyboard.press(' ');
  await page.waitForTimeout(200);
  st = await readState();
  check('space resumes', st && st.paused === false, JSON.stringify(st));

  // Restart with R.
  await page.keyboard.press('r');
  await page.waitForTimeout(400);
  st = await readState();
  check('R restarts the run', st && st.phase === 'playing' && st.wave === 0 && st.gold === 280, JSON.stringify(st));

  // --- Forked Paths (probe #4): the fork, the split, the Scout Kite,
  // and both lanes on the canvas. All of it runs against the real game
  // modules, imported from the served page.
  const fork = await page.evaluate(async () => {
    const g = window.__kitewarden;
    const ridge = await import('/src/ridge.js');
    const waves = await import('/src/waves.js');
    const enemies = await import('/src/enemies.js');
    const { mulberry32 } = await import('/src/random.js');
    const out = {};
    // 1. Both lanes exist, are the same length, and fork at (900, 360).
    out.laneLengths = { ridge: ridge.ridgeLength(), valley: ridge.valleyLength() };
    out.fork = { point: ridge.FORK_POINT, dist: ridge.FORK_DIST, wave: ridge.FORK_WAVE };
    out.forkOpens = { wave2: waves.buildWave(2, mulberry32(7)).fork, wave3: waves.buildWave(3, mulberry32(7)).fork };
    // 2. A wave's split is deterministic for a seed, and uses both lanes.
    const a = waves.buildWave(6, mulberry32(7));
    const b = waves.buildWave(6, mulberry32(7));
    out.splitDeterministic = JSON.stringify(a.spawns) === JSON.stringify(b.spawns);
    out.split = a.split;
    out.splitLanes = [...new Set(a.spawns.map((s) => s.lane))].sort();
    // 3. The Scout Kite is faster than a Wisp and frailer than a Wisp.
    out.scout = { speed: enemies.ENEMIES.scout.speed, hp: enemies.ENEMIES.scout.hp };
    out.wisp = { speed: enemies.ENEMIES.wisp.speed, hp: enemies.ENEMIES.wisp.hp };
    // 4. The wave banner names the split when wave 3 starts.
    g.reset(7);
    let s = g.state;
    s.phase = 'playing';
    s.audio = null;
    s.wave = 2;
    s.waveState = 'idle';
    g.startWave();
    out.banner = s.message;
    out.forkSplit = s.forkSplit;
    out.queueLanes = [...new Set(s.spawnQueue.map((q) => q.enemy.lane))].sort();
    // 5. A scout at the fork takes the less-defended lane: two archers
    // on the ridge side only (node 1 covers the middle run, node 3 covers
    // the bottom run; nothing watches the valley lane), so it must choose
    // valley.
    g.reset(11);
    s = g.state;
    s.phase = 'playing';
    s.audio = null;
    s.wave = 5;
    s.waveState = 'fighting';
    g.buildAt(1, 'archer');
    g.buildAt(3, 'archer');
    const scout = waves.spawnEnemy('scout', 5, 0, 'ridge');
    scout.dist = ridge.FORK_DIST - 2;
    s.enemies.push(scout);
    const STEP = 1 / 60;
    let ticks = 0;
    while (!scout.forked && ticks < 600) {
      g.stepSim(STEP);
      ticks++;
    }
    out.scoutLane = scout.lane;
    out.scoutForked = scout.forked;
    out.towersOnLanes = { ridge: g.combat.towersOnLane('ridge'), valley: g.combat.towersOnLane('valley') };
    // 6. Both lanes render: sample the canvas bed of each lane, off the
    // dashed centre line, on a plain playing board.
    g.reset(1);
    s = g.state;
    s.phase = 'playing';
    s.waveState = 'idle';
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const sample = (x, y) => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const close = (p, rgb, tol = 30) =>
      Math.abs(p[0] - rgb[0]) <= tol && Math.abs(p[1] - rgb[1]) <= tol && Math.abs(p[2] - rgb[2]) <= tol;
    const ridgeHits = [600, 640, 680].filter((x) => close(sample(x, 350), [138, 109, 75])).length;
    const valleyHits = [600, 640, 680].filter((x) => close(sample(x, 530), [113, 131, 90])).length;
    out.render = { ridgeHits, valleyHits };
    return out;
  });

  check(
    'fork lanes equal length (2828)',
    fork.laneLengths.ridge === 2828 && fork.laneLengths.valley === 2828,
    JSON.stringify(fork.laneLengths),
  );
  check(
    'fork node at (900,360), 1154px in, opens wave 3',
    fork.fork.point.x === 900 && fork.fork.point.y === 360 && fork.fork.dist === 1154 &&
      fork.fork.wave === 3 && fork.forkOpens.wave2 === false && fork.forkOpens.wave3 === true,
    JSON.stringify(fork.fork) + ' ' + JSON.stringify(fork.forkOpens),
  );
  check(
    'wave 6 splits both lanes, deterministically',
    fork.splitDeterministic && fork.split.ridge > 0 && fork.split.valley > 0 &&
      fork.splitLanes.length === 2,
    JSON.stringify(fork.split) + ' lanes=' + JSON.stringify(fork.splitLanes),
  );
  check(
    'wave banner names the split',
    typeof fork.banner === 'string' && fork.banner.includes('Ridge') && fork.banner.includes('Valley') &&
      fork.forkSplit && fork.forkSplit.ridge > 0 && fork.forkSplit.valley > 0 &&
      fork.queueLanes.length === 2,
    JSON.stringify(fork.banner) + ' ' + JSON.stringify(fork.forkSplit),
  );
  check(
    'scout kite: faster and frailer than wisp',
    fork.scout.speed > fork.wisp.speed && fork.scout.hp < fork.wisp.hp,
    JSON.stringify({ scout: fork.scout, wisp: fork.wisp }),
  );
  check(
    'scout takes the less-defended lane at the fork',
    fork.scoutForked === true && fork.scoutLane === 'valley' &&
      fork.towersOnLanes.ridge === 2 && fork.towersOnLanes.valley === 0,
    JSON.stringify({ lane: fork.scoutLane, towers: fork.towersOnLanes }),
  );
  check(
    'both lanes render (ridge brown, valley green)',
    fork.render.ridgeHits >= 2 && fork.render.valleyHits >= 2,
    JSON.stringify(fork.render),
  );

  await page.screenshot({ path: '/tmp/kitewarden-playtest.png' });
  await browser.close();
  check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  server.kill();
}

if (failures.length > 0) {
  console.error(`playtest: ${failures.length} failure(s): ${failures.join(', ')}`);
  process.exit(1);
}
console.log('playtest: all checks passed');
