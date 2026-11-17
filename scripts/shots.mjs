// KITEWARDEN — screenshot runner. Serves game/ locally, opens each staged
// shot from shots.json in headless Chromium at exactly 1280x720, and writes
// a JPEG per shot into screenshots/. Every shot must come out under the
// gate's 256 KiB cap; the quality steps down until it does. Any console
// error or page error fails the run loudly.
//
//   node scripts/shots.mjs [--port 8901]
//
// Uses the playwright-core already installed for the local Playwright CLI
// (no new install, no network beyond localhost).

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
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
const port = portIndex === -1 ? 8901 : Number(args[portIndex + 1]);
const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));
const outDir = join(repo, 'screenshots');
mkdirSync(outDir, { recursive: true });

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

const server = spawn('node', ['serve.ts', '--port', String(port)], {
  cwd: repo,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (d) => process.stdout.write(`[serve] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`[serve:err] ${d}`));

let failures = 0;
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

  for (const shot of shots) {
    const url = `http://127.0.0.1:${port}/${shot.query}`;
    console.log(`shot ${shot.name} <- ${url}`);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    // Staging runs synchronously in boot(); give the live game a few
    // frames so projectiles, trails and wind streaks are mid-flight. For
    // the action shots, wait briefly until shots are actually in the air
    // — but keep the wait short: every extra second lets the staged wave
    // thin out, and a cleared wave has nothing left to photograph.
    await page.waitForTimeout(700);
    if (shot.name.startsWith('2-') || shot.name.startsWith('3-')) {
      try {
        await page.waitForFunction(
          () => window.__kitewarden && window.__kitewarden.state.projectiles.length >= 3,
          { timeout: 2500 },
        );
      } catch {
        console.log('  note: no 3+ projectiles in flight at capture time');
      }
    } else {
      await page.waitForTimeout(1300);
    }
    const state = await page.evaluate(() => {
      const g = window.__kitewarden;
      if (!g) return { error: 'no game on window' };
      const s = g.state;
      // Lane counts, so the fork shot's evidence is in the log: how many
      // live enemies are on the Ridge lane vs the Valley lane, and how
      // many of them are Scout Kites.
      const lanes = { ridge: 0, valley: 0, scouts: 0 };
      for (const e of s.enemies) {
        if (e.lane === 'valley') lanes.valley++;
        else lanes.ridge++;
        if (e.def.id === 'scout') lanes.scouts++;
      }
      return {
        phase: s.phase,
        wave: s.wave,
        gold: s.gold,
        lives: s.lives,
        score: s.score,
        enemies: s.enemies.length,
        towers: s.towers().length,
        projectiles: s.projectiles.length,
        blessing: s.blessingOffer ? s.blessingOffer.length : 0,
        vanes: s.vanes.all().map((v) => s.vanes.labelOf(v)),
        lanes,
        forkSplit: s.forkSplit || null,
        banner: s.message || '',
      };
    });
    console.log(`  state: ${JSON.stringify(state)}`);
    if (state.error) {
      failures++;
      continue;
    }
    let quality = 85;
    let buf = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      buf = await page.screenshot({ type: 'jpeg', quality });
      console.log(`  jpeg q${quality}: ${buf.length} bytes`);
      if (buf.length <= 256 * 1024) break;
      quality -= 15;
    }
    if (buf.length > 256 * 1024) {
      console.error(`  FAIL: ${shot.name} still over 256 KiB at q${quality}`);
      failures++;
      continue;
    }
    writeFileSync(join(outDir, shot.name), buf);
    console.log(`  wrote screenshots/${shot.name}`);
  }
  await browser.close();
  if (errors.length > 0) {
    console.error('PAGE ERRORS:');
    for (const e of errors) console.error(`  ${e}`);
    failures++;
  }
} finally {
  server.kill();
}

if (failures > 0) {
  console.error(`shots: ${failures} failure(s)`);
  process.exit(1);
}
console.log('shots: all 4 screenshots written');
