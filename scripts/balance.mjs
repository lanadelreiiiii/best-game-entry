// KITEWARDEN — balance probe. Plays the real game headlessly, wave 1 to
// 20, with a simple but competent bot: build in priority order, upgrade the
// cheapest tower between waves, take the damage blessing when offered. The
// sim is stepped directly (fixed 60 Hz steps, synchronous), so a full run
// takes seconds. Reports lives/gold/kills per wave and whether the run ends
// in victory — the check that the game is winnable, not just playable.
//
//   node scripts/balance.mjs [--port 8903] [--seed 1]
//
// Exits non-zero if the run is lost: a tower defense the bot cannot win
// with a full build is tuned wrong.

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
const port = portIndex === -1 ? 8903 : Number(args[portIndex + 1]);
const seedIndex = args.indexOf('--seed');
const seed = seedIndex === -1 ? 1 : Number(args[seedIndex + 1]);
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
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(500);

  const result = await page.evaluate((seed) => {
    const g = window.__kitewarden;
    const STEP = 1 / 60;
    g.reset(seed);
    const s = g.state;
    s.phase = 'playing';
    s.audio = null;
    // Build priority: cover the top run first, then the lower runs.
    const BUILD = [
      { node: 0, type: 'archer' },
      { node: 1, type: 'fan' },
      { node: 2, type: 'rod' },
      { node: 3, type: 'ember' },
      { node: 4, type: 'snare' },
      { node: 5, type: 'beacon' },
      { node: 6, type: 'archer' },
      { node: 7, type: 'rod' },
    ];
    const log = [];
    let built = 0;
    let ticks = 0;
    const MAX_TICKS = 400000;
    while (ticks < MAX_TICKS) {
      if (s.phase === 'victory' || s.phase === 'gameover') break;
      if (s.phase === 'blessing' && s.blessingOffer) {
        // Prefer damage, then range, then whatever is first.
        const pref = ['silk', 'tailwind', 'hands', 'pockets'];
        let idx = 0;
        for (const p of pref) {
          const i = s.blessingOffer.findIndex((b) => b.id === p);
          if (i >= 0) { idx = i; break; }
        }
        g.chooseBlessing(idx);
        continue;
      }
      if (s.phase !== 'playing') break;
      if (s.waveState === 'idle' || s.waveState === 'done') {
        // Spend gold between waves: finish the build, then upgrade.
        let spent = true;
        while (spent) {
          spent = false;
          if (built < BUILD.length) {
            const next = BUILD[built];
            if (g.buildAt(next.node, next.type)) { built++; spent = true; continue; }
          }
          // Cheapest upgrade available.
          let best = null;
          let bestCost = Infinity;
          for (const t of s.towers()) {
            const c = t.def.cost;
            if (t.level >= 4) continue;
            const up = Math.round(c * [0, 0, 0.6, 1.1, 1.8][t.level + 1] || 0);
            if (up > 0 && up < bestCost && s.gold >= up) { best = t; bestCost = up; }
          }
          if (best) {
            s.selection = { kind: 'tower', id: best.node.id };
            if (g.upgradeSelected()) spent = true;
            g.clearSelection();
          }
        }
        const waveBefore = s.wave;
        if (!g.startWave()) break;
        // Step this wave to its end.
        let waveTicks = 0;
        while (
          s.phase === 'playing' &&
          (s.waveState === 'spawning' || s.waveState === 'fighting') &&
          waveTicks < 20000
        ) {
          g.stepSim(STEP);
          ticks++;
          waveTicks++;
        }
        log.push({
          wave: waveBefore + 1,
          lives: s.lives,
          gold: s.gold,
          kills: s.kills,
          score: s.score,
          towers: s.towers().length,
        });
        continue;
      }
      // Safety: step a little if we ever land somewhere unexpected.
      g.stepSim(STEP);
      ticks++;
    }
    return {
      phase: s.phase,
      wave: s.wave,
      lives: s.lives,
      gold: s.gold,
      kills: s.kills,
      score: s.score,
      ticks,
      log,
    };
  }, seed);

  console.log(`balance (seed ${seed}): phase=${result.phase} wave=${result.wave} lives=${result.lives} kills=${result.kills} score=${result.score} ticks=${result.ticks}`);
  for (const row of result.log) {
    console.log(`  wave ${String(row.wave).padStart(2)}: lives=${String(row.lives).padStart(2)} gold=${String(row.gold).padStart(5)} kills=${String(row.kills).padStart(3)} towers=${row.towers}`);
  }
  if (result.phase !== 'victory') {
    console.error(`balance: FAIL — run ended ${result.phase} on wave ${result.wave} (lives ${result.lives})`);
    failures++;
  }
  if (errors.length > 0) {
    console.error('PAGE ERRORS:');
    for (const e of errors) console.error(`  ${e}`);
    failures++;
  }
  await browser.close();
} finally {
  server.kill();
}

if (failures > 0) {
  console.error(`balance: ${failures} failure(s)`);
  process.exit(1);
}
console.log('balance: PASS — the run is winnable end to end');
