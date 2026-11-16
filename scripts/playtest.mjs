// KITEWARDEN — automated playtest. Plays the real game like a player:
// title -> start -> select a node -> build an Archer with key 1 -> start
// wave 1 with Space -> let it run -> pause and resume -> restart. Asserts
// the wave actually starts, towers actually fire, and nothing throws.
// Exits non-zero on any failure. Writes one evidence screenshot to /tmp
// (never into screenshots/, which only holds staged shots).
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
      };
    });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(800);
  let st = await readState();
  check('game boots to title', st && st.phase === 'title', JSON.stringify(st));

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
  check('archer built with key 1', st && st.towers === 1 && st.gold === 150, JSON.stringify(st));

  // Build a second tower on node 1 with the mouse menu (click node, click
  // the Fan row). The menu opens right of the node: rows start at
  // (node.x + 40, node.y - 90), 52px tall; Fan is the second row.
  await page.mouse.click(560, 245);
  await page.waitForTimeout(300);
  await page.mouse.click(700, 230);
  await page.waitForTimeout(300);
  st = await readState();
  check('second tower built via menu', st && st.towers === 2 && st.gold === 70, JSON.stringify(st));

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
  check('R restarts the run', st && st.phase === 'playing' && st.wave === 0 && st.gold === 200, JSON.stringify(st));

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
