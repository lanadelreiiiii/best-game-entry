// KITEWARDEN — the HUD and the menus. One job: everything drawn on top of
// the world — the top bar (gold, lives, wave, score, wind, buttons), the
// build menu, the tower panel, the blessing choice, and the title / victory
// / game-over / paused screens. `hudLayout` returns every clickable rect,
// so input.js and the renderer always agree on where things are.
// The cover's design note names the wind-vane mechanic outright and the
// fork in one line, and a one-line legend at the bottom of the screen keeps
// the vane mechanic in front of the player all run long.

import { TOWERS, TOWER_ORDER, upgradeCost, MAX_TOWER_LEVEL } from './towers.js';

export const HUD = { W: 1280, H: 720, BAR: 56 };

function rect(x, y, w, h) {
  return { x, y, w, h };
}

export function inRect(r, x, y) {
  return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// Every clickable region, computed from the state. Pure function of state.
export function hudLayout(state) {
  const L = {
    startWave: rect(1010, 10, 128, 36),
    speed: rect(1146, 10, 40, 36),
    pause: rect(1192, 10, 40, 36),
    mute: rect(960, 10, 40, 36),
    buildMenu: [],
    towerPanel: null,
    blessingCards: [],
    titleStart: rect(490, 470, 300, 52),
    victoryEndless: rect(400, 520, 200, 48),
    victoryRestart: rect(680, 520, 200, 48),
    gameoverRestart: rect(490, 500, 300, 52),
  };
  if (state.selection && state.selection.kind === 'node') {
    const node = state.nodes[state.selection.id];
    const px = Math.min(1020, node.x + 40);
    // Six rows must fit on screen even for the lowest nodes.
    const menuH = TOWER_ORDER.length * 48;
    const py = Math.max(66, Math.min(720 - menuH - 12, node.y - 90));
    TOWER_ORDER.forEach((id, i) => {
      L.buildMenu.push({ id, r: rect(px, py + i * 48, 220, 44) });
    });
  }
  if (state.selection && state.selection.kind === 'tower') {
    const tower = state.towerAt(state.selection.id);
    if (tower) {
      const px = Math.min(980, tower.x + 40);
      const py = Math.max(66, Math.min(520, tower.y - 80));
      const cost = upgradeCost(tower.def, tower.level);
      L.towerPanel = {
        r: rect(px, py, 260, 150),
        upgrade: cost === null ? null : rect(px + 14, py + 104, 116, 32),
        sell: rect(px + 140, py + 104, 106, 32),
      };
    }
  }
  if (state.phase === 'blessing' && state.blessingOffer) {
    state.blessingOffer.forEach((b, i) => {
      L.blessingCards.push({ id: b.id, index: i, r: rect(290 + i * 240, 250, 220, 220) });
    });
  }
  return L;
}

function button(ctx, r, label, opts = {}) {
  const active = opts.active;
  ctx.fillStyle = active ? '#ffd94d' : opts.dim ? '#2b3a46' : '#3a4753';
  ctx.strokeStyle = active ? '#8a6d1f' : '#c9a35c';
  ctx.lineWidth = 1.5;
  roundRect(ctx, r.x, r.y, r.w, r.h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = active ? '#141c24' : '#f2ead8';
  ctx.font = (opts.small ? 'bold 12px' : 'bold 14px') + ' system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 5);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Speaker icon drawn with paths (no emoji font needed): a speaker cone
// with sound waves, or an X when muted.
function drawMuteButton(ctx, r, muted) {
  ctx.fillStyle = '#3a4753';
  ctx.strokeStyle = '#c9a35c';
  ctx.lineWidth = 1.5;
  roundRect(ctx, r.x, r.y, r.w, r.h, 6);
  ctx.fill();
  ctx.stroke();
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.fillStyle = '#f2ead8';
  ctx.strokeStyle = '#f2ead8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 3);
  ctx.lineTo(cx - 4, cy - 3);
  ctx.lineTo(cx + 1, cy - 8);
  ctx.lineTo(cx + 1, cy + 8);
  ctx.lineTo(cx - 4, cy + 3);
  ctx.lineTo(cx - 9, cy + 3);
  ctx.closePath();
  ctx.fill();
  if (muted) {
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy - 6);
    ctx.lineTo(cx + 12, cy + 6);
    ctx.moveTo(cx + 12, cy - 6);
    ctx.lineTo(cx + 5, cy + 6);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx + 4, cy, 5, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 4, cy, 9, -0.9, 0.9);
    ctx.stroke();
  }
}

function panel(ctx, r, fill = 'rgba(20, 28, 36, 0.94)') {
  ctx.fillStyle = fill;
  ctx.strokeStyle = '#c9a35c';
  ctx.lineWidth = 1.5;
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fill();
  ctx.stroke();
}

export function drawHud(ctx, state, layout) {
  // Top bar.
  ctx.fillStyle = '#141c24';
  ctx.fillRect(0, 0, 1280, HUD.BAR);
  ctx.fillStyle = '#c9a35c';
  ctx.fillRect(0, HUD.BAR, 1280, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('KITEWARDEN', 16, 36);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(`◈ ${state.gold}`, 200, 35);
  ctx.fillStyle = state.lives <= 5 ? '#ff6b6b' : '#ff8c8c';
  ctx.fillText(`♥ ${state.lives}`, 300, 35);
  ctx.fillStyle = '#f2ead8';
  ctx.fillText(`Wave ${state.waveLabel}`, 400, 35);
  ctx.fillText(`Score ${state.score}`, 520, 35);
  // Wind compass.
  const wind = state.wind;
  const wv = wind.vector();
  ctx.fillStyle = '#5ec8c0';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`Wind ${wind.label}`, 660, 35);
  ctx.save();
  ctx.translate(760, 28);
  ctx.rotate(Math.atan2(wv.y, wv.x));
  ctx.fillStyle = '#5ec8c0';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-8, -6);
  ctx.lineTo(-8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const strength = wind.effectiveStrength();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = strength * 4 > i ? '#5ec8c0' : '#2b3a46';
    ctx.fillRect(782 + i * 12, 36 - (i + 1) * 4, 8, (i + 1) * 4);
  }
  // Buttons. The start button always says what the next action is.
  const waveBusy = state.waveState === 'spawning' || state.waveState === 'fighting';
  let startLabel;
  let startDim = false;
  if (state.phase === 'playing') {
    startLabel = waveBusy ? 'Wave running…' : state.wave === 0 ? 'Start Wave 1' : `Start Wave ${state.wave + 1}`;
    startDim = waveBusy;
  } else if (state.phase === 'blessing') {
    startLabel = 'Pick a blessing…';
    startDim = true;
  } else if (state.phase === 'title') {
    startLabel = 'Start Wave 1';
    startDim = true;
  } else {
    startLabel = '—';
    startDim = true;
  }
  button(ctx, layout.startWave, startLabel, { small: true, dim: startDim });
  button(ctx, layout.speed, state.speed === 2 ? '2×' : '1×', { small: true, active: state.speed === 2 });
  button(ctx, layout.pause, state.paused ? '▶' : '❚❚', { small: true });
  drawMuteButton(ctx, layout.mute, state.muted);
  // Banner line under the bar.
  if (state.message && state.time < state.messageUntil) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20, 28, 36, 0.85)';
    const w = ctx.measureText(state.message).width + 36;
    roundRect(ctx, 640 - w / 2, 64, w, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(state.message, 640, 84);
  }
  // Kill-feed hint at the bottom left.
  if (state.phase === 'playing' && state.wave === 0 && state.kills === 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(242, 234, 216, 0.85)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Click a ＋ node to build a kite tower — then press Start Wave.', 16, 700);
  }
  // Wind-vane legend, bottom right, all run long: the mechanic in one line.
  if (state.phase === 'playing' || state.phase === 'blessing') {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5ec8c0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('◆ WIND VANES: click a vane to turn the wind — free, anytime', 1264, 700);
  }
}

export function drawOverlays(ctx, state, layout) {
  if (state.phase === 'title') drawTitle(ctx, state, layout);
  if (state.phase === 'blessing') drawBlessing(ctx, state, layout);
  if (state.phase === 'victory') drawVictory(ctx, state, layout);
  if (state.phase === 'gameover') drawGameOver(ctx, state, layout);
  if (state.paused && state.phase === 'playing') {
    ctx.fillStyle = 'rgba(20, 28, 36, 0.55)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#f2ead8';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', 640, 350);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Space to resume · R to restart', 640, 390);
  }
  if (state.selection && state.selection.kind === 'node') drawBuildMenu(ctx, state, layout);
  if (state.selection && state.selection.kind === 'tower') drawTowerPanel(ctx, state, layout);
}

function drawTitle(ctx, state, layout) {
  ctx.fillStyle = 'rgba(20, 28, 36, 0.45)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.fillText('KITEWARDEN', 640, 240);
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText('Hold the ridge against the storm.', 640, 285);
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = '#5ec8c0';
  ctx.fillText('WIND VANES: click a vane to turn the wind — bend shots around corners.', 640, 324);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242, 234, 216, 0.95)';
  ctx.fillText(
    'The wind bends every shot, so a tower standing downwind reaches farther.',
    640,
    352,
  );
  ctx.fillText(
    'Build on the ridge nodes, turn the vanes to steer the wind, hold both fork lanes,',
    640,
    376,
  );
  ctx.fillText('and face the Storm Serpent every fifth wave — then keep going, endlessly.', 640, 400);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242, 234, 216, 0.7)';
  ctx.fillText('Click a node to build · click a vane to turn the wind (free) · Space starts a wave · F fast-forward · R restart', 640, 438);
  button(ctx, layout.titleStart, '▶  START THE DEFENSE', {});
  ctx.fillStyle = 'rgba(242, 234, 216, 0.6)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('20 waves + endless · 6 towers · 7 enemies · 3 wind vanes · a blessing every 5 waves', 640, 560);
}

function drawBuildMenu(ctx, state, layout) {
  const node = state.nodes[state.selection.id];
  const px = layout.buildMenu[0] ? layout.buildMenu[0].r.x : 0;
  const py = layout.buildMenu[0] ? layout.buildMenu[0].r.y - 30 : 0;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('BUILD — pick a kite', px, py + 18);
  for (const item of layout.buildMenu) {
    const def = TOWERS[item.id];
    const afford = state.gold >= def.cost;
    const hotkey = TOWER_ORDER.indexOf(item.id) + 1;
    panel(ctx, item.r, afford ? 'rgba(20, 28, 36, 0.94)' : 'rgba(20, 28, 36, 0.6)');
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(item.r.x + 20, item.r.y + 23, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = afford ? '#f2ead8' : '#7a8a99';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`${hotkey}  ${def.name}`, item.r.x + 36, item.r.y + 19);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#c9d4dd';
    ctx.fillText(def.blurb, item.r.x + 36, item.r.y + 35);
    ctx.fillStyle = afford ? '#ffd94d' : '#ff6b6b';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`◈ ${def.cost}`, item.r.x + item.r.w - 10, item.r.y + 19);
    ctx.textAlign = 'left';
  }
}

function drawTowerPanel(ctx, state, layout) {
  const tower = state.towerAt(state.selection.id);
  if (!tower || !layout.towerPanel) return;
  const p = layout.towerPanel;
  panel(ctx, p.r);
  ctx.textAlign = 'left';
  ctx.fillStyle = tower.def.color;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`${tower.def.name} — Lv ${tower.level}`, p.r.x + 14, p.r.y + 24);
  ctx.fillStyle = '#c9d4dd';
  ctx.font = '12px system-ui, sans-serif';
  const stats = tower.stats;
  ctx.fillText(`Damage ${Math.round(stats.damage)}   Range ${Math.round(stats.range)}`, p.r.x + 14, p.r.y + 46);
  ctx.fillText(`Rate ${stats.rate.toFixed(1)}/s   Kills ${tower.kills}`, p.r.x + 14, p.r.y + 64);
  ctx.fillText(tower.def.blurb, p.r.x + 14, p.r.y + 84);
  const cost = upgradeCost(tower.def, tower.level);
  if (cost !== null) {
    button(ctx, p.upgrade, `Upgrade ◈ ${cost}`, { small: true, dim: state.gold < cost });
  } else {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('MAX LEVEL', p.r.x + 14, p.r.y + 124);
  }
  button(ctx, p.sell, `Sell ◈ ${Math.round(tower.invested * 0.7)}`, { small: true });
}

function drawBlessing(ctx, state, layout) {
  ctx.fillStyle = 'rgba(20, 28, 36, 0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText('THE STORM OFFERS A BLESSING', 640, 180);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`Wave ${state.wave} cleared — choose one. It lasts for the rest of the run.`, 640, 214);
  state.blessingOffer.forEach((b, i) => {
    const card = layout.blessingCards[i];
    if (!card) return;
    const r = card.r;
    panel(ctx, r, 'rgba(38, 50, 62, 0.97)');
    ctx.fillStyle = '#5ec8c0';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(['✦', '❖', '◆'][i], r.x + r.w / 2, r.y + 64);
    ctx.fillStyle = '#f2ead8';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(b.name, r.x + r.w / 2, r.y + 108);
    ctx.fillStyle = '#c9d4dd';
    ctx.font = '13px system-ui, sans-serif';
    wrapText(ctx, b.blurb, r.x + r.w / 2, r.y + 138, r.w - 28, 19);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`Press ${i + 1}`, r.x + r.w / 2, r.y + r.h - 18);
  });
}

function drawVictory(ctx, state, layout) {
  ctx.fillStyle = 'rgba(20, 28, 36, 0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillText('THE RIDGE HOLDS', 640, 260);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Twenty waves, and the storm breaks against your kites.', 640, 310);
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(
    `Score ${state.score}   ·   ${state.kills} kills   ·   ${state.earned} gold earned   ·   ${state.leaks} leaked`,
    640,
    360,
  );
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242, 234, 216, 0.85)';
  ctx.fillText('The wind never stops — keep going, endlessly, or start a fresh storm.', 640, 400);
  button(ctx, layout.victoryEndless, 'ENDLESS MODE ∞', {});
  button(ctx, layout.victoryRestart, '↻  NEW RUN', {});
}

function drawGameOver(ctx, state, layout) {
  ctx.fillStyle = 'rgba(20, 28, 36, 0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillText('THE RIDGE FALLS', 640, 280);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`The storm broke through on wave ${Math.max(1, state.wave)}.`, 640, 330);
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`Score ${state.score}   ·   ${state.kills} kills   ·   ${state.earned} gold earned`, 640, 380);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242, 234, 216, 0.85)';
  ctx.fillText('The kites will fly again. Press R or the button below.', 640, 420);
  button(ctx, layout.gameoverRestart, '↻  TRY AGAIN', {});
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
}
