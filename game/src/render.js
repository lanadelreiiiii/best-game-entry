// KITEWARDEN — the renderer. One job: draw the game. The sim writes the
// state; this file only reads it. Sky, ridge, towers, enemies, the curved
// trails of wind-bent shots, particles, and the wind itself — then it hands
// the menus and HUD to hud.js.

import { RIDGE_PATH, BUILD_NODES, PATH_WIDTH, NODE_RADIUS } from './ridge.js';
import { drawHud, drawOverlays, hudLayout } from './hud.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(state) {
    const ctx = this.ctx;
    ctx.save();
    if (state.shake > 0.5) {
      const m = state.shake;
      const t = state.tick;
      ctx.translate(
        Math.sin(t * 1.7) * m * 0.5 + Math.sin(t * 3.1) * m * 0.3,
        Math.cos(t * 2.3) * m * 0.5 + Math.sin(t * 4.7) * m * 0.3,
      );
    }
    this.drawSky(ctx, state);
    this.drawHills(ctx);
    this.drawPath(ctx);
    this.drawNodes(ctx, state);
    this.drawTowers(ctx, state);
    this.drawEnemies(ctx, state);
    this.drawProjectiles(ctx, state);
    this.drawParticles(ctx, state);
    this.drawFloaters(ctx, state);
    this.drawWindStreaks(ctx, state);
    ctx.restore();
    const layout = hudLayout(state);
    drawHud(ctx, state, layout);
    drawOverlays(ctx, state, layout);
  }

  drawSky(ctx, state) {
    // Dusk storm sky: slate blue above, a warm band where the sun went down.
    const sky = ctx.createLinearGradient(0, 0, 0, 720);
    sky.addColorStop(0, '#1d2836');
    sky.addColorStop(0.45, '#2c3c4c');
    sky.addColorStop(0.7, '#6b543a');
    sky.addColorStop(1, '#3d4a38');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1280, 720);
    // Low sun glow behind the storm.
    const glow = ctx.createRadialGradient(1010, 640, 10, 1010, 640, 420);
    glow.addColorStop(0, 'rgba(255, 166, 66, 0.34)');
    glow.addColorStop(1, 'rgba(255, 166, 66, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1280, 720);
    // Slow cloud bands.
    ctx.fillStyle = 'rgba(16, 24, 33, 0.5)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 340 + state.time * 6 * (1 + i * 0.2)) % 1500) - 120;
      const cy = 44 + i * 26;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 190, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHills(ctx) {
    ctx.fillStyle = '#222f3b';
    ctx.beginPath();
    ctx.moveTo(0, 720);
    ctx.lineTo(0, 640);
    ctx.quadraticCurveTo(220, 560, 470, 640);
    ctx.quadraticCurveTo(760, 700, 1000, 630);
    ctx.quadraticCurveTo(1180, 590, 1280, 640);
    ctx.lineTo(1280, 720);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b3a46';
    ctx.beginPath();
    ctx.moveTo(0, 720);
    ctx.lineTo(0, 690);
    ctx.quadraticCurveTo(300, 630, 640, 685);
    ctx.quadraticCurveTo(980, 720, 1280, 675);
    ctx.lineTo(1280, 720);
    ctx.closePath();
    ctx.fill();
  }

  drawPath(ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#6b543a';
    ctx.lineWidth = PATH_WIDTH + 8;
    ctx.beginPath();
    RIDGE_PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.strokeStyle = '#8a6d4b';
    ctx.lineWidth = PATH_WIDTH;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(242, 234, 216, 0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 18]);
    ctx.beginPath();
    RIDGE_PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    // West gate (spawn) and east gate (exit), drawn just inside the canvas
    // so their labels are never clipped by the edge.
    this.drawGate(ctx, 26, RIDGE_PATH[0].y, 'WEST GATE', 1);
    this.drawGate(ctx, 1254, RIDGE_PATH[RIDGE_PATH.length - 1].y, 'EAST GATE', -1);
  }

  drawGate(ctx, x, y, label, labelSide) {
    ctx.fillStyle = '#141c24';
    ctx.strokeStyle = '#c9a35c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◈', x, y + 3);
    ctx.fillStyle = 'rgba(242, 234, 216, 0.75)';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = labelSide > 0 ? 'left' : 'right';
    ctx.fillText(label, x + labelSide * 26, y + 4);
    ctx.textAlign = 'center';
  }

  drawNodes(ctx, state) {
    for (const node of state.nodes) {
      const selected =
        state.selection && state.selection.kind === 'node' && state.selection.id === node.id;
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#3a4753';
      ctx.fill();
      ctx.strokeStyle = selected ? '#ffd94d' : '#c9a35c';
      ctx.lineWidth = selected ? 3 : 2;
      ctx.stroke();
      if (!node.tower) {
        ctx.fillStyle = 'rgba(242, 234, 216, 0.5)';
        ctx.font = '16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('＋', node.x, node.y + 6);
      }
    }
  }

  drawTowers(ctx, state) {
    for (const tower of state.towers()) {
      const node = tower.node;
      if (
        state.selection &&
        state.selection.kind === 'tower' &&
        state.selection.id === node.id
      ) {
        const stats = tower.stats;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, stats.range, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 217, 77, 0.07)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 217, 77, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      this.drawTower(ctx, tower);
    }
  }

  drawTower(ctx, tower) {
    const def = tower.def;
    const lvl = tower.level;
    // Stone base.
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#4a5866';
    ctx.fill();
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 2;
    ctx.stroke();
    // The kite itself, turning toward its target.
    ctx.save();
    ctx.translate(tower.x, tower.y - 6);
    ctx.rotate(tower.aim || -Math.PI / 2);
    ctx.fillStyle = def.color;
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 1.5;
    if (def.shape === 'diamond' || def.shape === 'hex') {
      const r = def.shape === 'hex' ? 13 : 15;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(0, r * 0.7);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (def.shape === 'fan') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 15, -0.9, 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (def.shape === 'rod') {
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(5, 4);
      ctx.lineTo(-5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 8, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff6c9';
      ctx.fill();
    } else if (def.shape === 'beacon') {
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Kite string down to the base.
    ctx.strokeStyle = 'rgba(242, 234, 216, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y - 6);
    ctx.lineTo(tower.x, tower.y + 12);
    ctx.stroke();
    // Level pips.
    for (let i = 0; i < lvl; i++) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(tower.x - 8 + i * 8, tower.y + 24, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEnemies(ctx, state) {
    for (const e of state.enemies) {
      this.drawEnemy(ctx, e, state);
    }
  }

  drawEnemy(ctx, e, state) {
    const def = e.def;
    const slowed = state.time < e.slowUntil;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.flash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
    }
    if (def.shape === 'serpent') {
      // Segmented body trailing behind the head.
      for (let i = 4; i >= 1; i--) {
        const bx = -Math.cos(e.angle) * i * 20 + Math.sin(state.time * 4 + i) * 5;
        const by = -Math.sin(e.angle) * i * 20 + Math.cos(state.time * 3 + i) * 5;
        ctx.fillStyle = i % 2 ? def.color : def.dark;
        ctx.beginPath();
        ctx.arc(bx, by, 20 - i * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = def.color;
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 2;
    if (def.shape === 'wisp') {
      ctx.beginPath();
      ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-3, -3, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.shape === 'drifter') {
      ctx.beginPath();
      ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = def.dark;
      ctx.beginPath();
      ctx.arc(-4, -3, 4, 0, Math.PI * 2);
      ctx.arc(5, 4, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.shape === 'gustling') {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 ? def.radius * 0.7 : def.radius + 4;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (def.shape === 'shearling') {
      ctx.beginPath();
      ctx.moveTo(0, -def.radius);
      ctx.lineTo(def.radius, 0);
      ctx.lineTo(0, def.radius);
      ctx.lineTo(-def.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(6, 6);
      ctx.moveTo(6, -6);
      ctx.lineTo(-6, 6);
      ctx.stroke();
    } else {
      // Serpent head.
      ctx.beginPath();
      ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#141c24';
      ctx.beginPath();
      ctx.arc(8, -8, 4, 0, Math.PI * 2);
      ctx.arc(8, 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(9, -8, 1.8, 0, Math.PI * 2);
      ctx.arc(9, 8, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Slow tint.
    if (slowed) {
      ctx.fillStyle = 'rgba(180, 140, 232, 0.35)';
      ctx.beginPath();
      ctx.arc(e.x, e.y, def.radius + 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Health bar (only when hurt).
    if (e.hp < e.maxHp) {
      const w = def.radius * 2;
      ctx.fillStyle = 'rgba(20, 28, 36, 0.8)';
      ctx.fillRect(e.x - w / 2, e.y - def.radius - 12, w, 5);
      ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#7fe0a8' : '#ff6b6b';
      ctx.fillRect(e.x - w / 2, e.y - def.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
    }
  }

  drawProjectiles(ctx, state) {
    for (const p of state.projectiles) {
      if (p.trail.length > 1) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        p.trail.forEach((t, i) => (i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y)));
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (p.kind === 'rod') {
        // Lightning: a jittered bright line from the shot's tail to its head.
        ctx.strokeStyle = '#fff6c9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        const tail = p.trail[0] || { x: p.x - 20, y: p.y };
        ctx.lineTo((p.x + tail.x) / 2 + (Math.sin(p.x * 3) * 6), (p.y + tail.y) / 2);
        ctx.lineTo(tail.x, tail.y);
        ctx.stroke();
      }
      ctx.fillStyle = p.kind === 'rod' ? '#fff6c9' : p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'rod' ? 4 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawParticles(ctx, state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters(ctx, state) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  drawWindStreaks(ctx, state) {
    const wind = state.wind.vector();
    const strength = state.wind.effectiveStrength();
    const count = Math.round(10 + strength * 22);
    ctx.strokeStyle = `rgba(242, 234, 216, ${0.1 + strength * 0.16})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < count; i++) {
      const seed = i * 137.5;
      const speed = 40 + strength * 160;
      const span = 1600;
      const t = ((state.time * speed + seed) % span) - 160;
      const lane = 90 + ((i * 53) % 580);
      const len = 26 + strength * 42;
      const x = t + lane * 0.35;
      const y = lane;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + wind.x * len, y + wind.y * len);
      ctx.stroke();
    }
  }
}
