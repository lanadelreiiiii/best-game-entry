// KITEWARDEN — the renderer. One job: draw the game. The sim writes the
// state; this file only reads it. Sky, ridge, towers, enemies, the curved
// trails of wind-bent shots, particles, the wind vanes and their rings,
// and the wind itself — then it hands the menus and HUD to hud.js.

import { RIDGE_PATH, BUILD_NODES, PATH_WIDTH, NODE_RADIUS, distanceToPath } from './ridge.js';
import { drawHud, drawOverlays, hudLayout } from './hud.js';
import { mulberry32 } from './random.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Deterministic ridge decoration, fixed at construction: grass tufts,
    // stones, wildflowers and grounded kites in the pockets between the
    // path's runs. Positions are seeded once, never re-rolled per frame,
    // so the board reads the same every run.
    const rng = mulberry32(7);
    this.terrain = [];
    for (let gy = 0; gy < 9; gy++) {
      for (let gx = 0; gx < 16; gx++) {
        const x = 60 + gx * 76 + rng() * 40;
        const y = 105 + gy * 58 + rng() * 30;
        if (y > 610) continue;
        if (distanceToPath(x, y) < 52) continue;
        if (BUILD_NODES.some((n) => Math.hypot(n.x - x, n.y - y) < 58)) continue;
        const roll = rng();
        this.terrain.push({
          x,
          y,
          kind: roll < 0.55 ? 'grass' : roll < 0.8 ? 'stone' : roll < 0.93 ? 'flower' : 'kite',
          rot: rng() * Math.PI * 2,
          s: 0.7 + rng() * 0.6,
          hue: rng(),
        });
      }
    }
    // Three kites that live in the sky, drifting with the wind — the ridge
    // is a place where kites fly, not just a battlefield.
    this.skyKites = [
      { x: 220, y: 70, s: 1.1, color: '#ff8c42', phase: 0 },
      { x: 640, y: 52, s: 0.9, color: '#5ec8c0', phase: 2.1 },
      { x: 1060, y: 82, s: 1.25, color: '#ffd94d', phase: 4.2 },
    ];
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
    this.drawTerrain(ctx, state);
    this.drawPath(ctx);
    this.drawNodes(ctx, state);
    this.drawVanes(ctx, state);
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
    // Kites in the sky, drifting with the wind — they bob and sway, and
    // their tails stream downwind.
    const wind = state.wind.vector();
    for (const k of this.skyKites) {
      const bob = Math.sin(state.time * 0.9 + k.phase) * 7;
      const sway = Math.sin(state.time * 0.5 + k.phase * 2) * 12;
      const kx = k.x + sway + wind.x * 14;
      const ky = k.y + bob + wind.y * 8;
      ctx.save();
      ctx.translate(kx, ky);
      ctx.rotate(Math.sin(state.time * 0.7 + k.phase) * 0.25);
      ctx.fillStyle = k.color;
      ctx.strokeStyle = 'rgba(20, 28, 36, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -13 * k.s);
      ctx.lineTo(10 * k.s, 0);
      ctx.lineTo(0, 13 * k.s);
      ctx.lineTo(-10 * k.s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Tail streaming downwind.
      ctx.strokeStyle = 'rgba(242, 234, 216, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 13 * k.s);
      const tx = wind.x * 26 + Math.sin(state.time * 2 + k.phase) * 5;
      const ty = 13 * k.s + 24 + wind.y * 10;
      ctx.quadraticCurveTo(6, 13 * k.s + 14, tx, ty);
      ctx.stroke();
      ctx.restore();
    }
  }

  // The ridge floor: grass, stones, wildflowers and grounded kites in the
  // pockets the path leaves open. This is what stops the board reading as
  // one big empty rectangle.
  drawTerrain(ctx, state) {
    const sway = Math.sin(state.time * 1.3) * 1.5;
    for (const t of this.terrain) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      if (t.kind === 'grass') {
        ctx.strokeStyle = 'rgba(127, 224, 168, 0.4)';
        ctx.lineWidth = 1.5;
        for (let b = -1; b <= 1; b++) {
          ctx.beginPath();
          ctx.moveTo(b * 4, 0);
          ctx.quadraticCurveTo(b * 4 + sway, -8 * t.s, b * 5 + sway * 1.5, -12 * t.s);
          ctx.stroke();
        }
      } else if (t.kind === 'stone') {
        ctx.fillStyle = 'rgba(90, 104, 118, 0.55)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 7 * t.s, 5 * t.s, t.rot, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(242, 234, 216, 0.18)';
        ctx.beginPath();
        ctx.ellipse(-2 * t.s, -2 * t.s, 3 * t.s, 2 * t.s, t.rot, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.kind === 'flower') {
        const petals = ['#e8a7d0', '#ffd94d', '#f2ead8'];
        ctx.fillStyle = petals[Math.floor(t.hue * 3)];
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 4, Math.sin(a) * 4, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ff8c42';
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // A grounded kite, leaning in the grass — the ridge's own debris.
        ctx.fillStyle = 'rgba(255, 140, 66, 0.5)';
        ctx.beginPath();
        ctx.moveTo(0, -9 * t.s);
        ctx.lineTo(7 * t.s, 0);
        ctx.lineTo(0, 9 * t.s);
        ctx.lineTo(-7 * t.s, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(242, 234, 216, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 9 * t.s);
        ctx.lineTo(10 * t.s, 18 * t.s);
        ctx.stroke();
      }
      ctx.restore();
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

  // The wind vanes: each one is a big, readable kite-vane — a dashed
  // influence ring, a stone mast, a kite diamond and a long arrow pointing
  // the way the local wind blows inside the ring, and a compass label
  // above it. A vane you just turned throws an expanding pulse ring.
  // Hovering one lights a gold ring and a "click to turn" hint, so the
  // mechanic is discoverable without reading anything.
  drawVanes(ctx, state) {
    const vanes = state.vanes;
    if (!vanes) return;
    const hovered =
      state.phase === 'playing' && state.hover
        ? vanes.all().find((v) => Math.hypot(state.hover.x - v.x, state.hover.y - v.y) < 36)
        : null;
    for (const vane of vanes.all()) {
      const angle = vanes.angleOf(vane);
      const label = vanes.labelOf(vane);
      // Influence ring: faint teal fill, dashed rim — the ground the
      // vane's wind rules.
      ctx.beginPath();
      ctx.arc(vane.x, vane.y, vane.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(94, 200, 192, 0.05)';
      ctx.fill();
      ctx.setLineDash([8, 10]);
      ctx.strokeStyle = 'rgba(94, 200, 192, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      // Toggle pulse: an expanding gold ring for three sim seconds after
      // a turn, so the moment reads even in a still frame. A pulse held
      // open longer than that (screenshot staging holds one mid-flight)
      // freezes mid-expansion instead of running past its own radius.
      if (state.time < vane.pulseUntil) {
        const remaining = vane.pulseUntil - state.time;
        const p =
          remaining > 3 ? 0.45 : Math.max(0, Math.min(1, 1 - remaining / 3));
        ctx.beginPath();
        ctx.arc(vane.x, vane.y, 26 + p * (vane.radius - 26), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 217, 77, ${(1 - p) * 0.85})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 217, 77, ${0.9 - p * 0.6})`;
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`TURNED ${label}`, vane.x, vane.y - vane.radius - 8);
      }
      // Hover ring: the vane is clickable, and the cursor should say so.
      if (hovered === vane) {
        ctx.beginPath();
        ctx.arc(vane.x, vane.y, 32, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffd94d';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#ffd94d';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CLICK TO TURN THE WIND — FREE', vane.x, vane.y + 52);
      }
      // Stone mast.
      ctx.beginPath();
      ctx.arc(vane.x, vane.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#2b3a46';
      ctx.fill();
      ctx.strokeStyle = '#c9a35c';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // The kite diamond, turned to the vane's heading, with a long
      // arrow shaft and head pointing the way the local wind blows.
      ctx.save();
      ctx.translate(vane.x, vane.y);
      ctx.rotate(angle);
      ctx.fillStyle = '#5ec8c0';
      ctx.strokeStyle = '#1d5a55';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-14, 0);
      ctx.lineTo(0, -11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(40, 0);
      ctx.lineTo(28, -7);
      ctx.lineTo(28, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Compass label in a dark pill above the mast, and a small
      // "WIND VANE" caption below it — legible at contact-sheet size.
      ctx.font = 'bold 15px system-ui, sans-serif';
      const lw = ctx.measureText(label).width + 16;
      ctx.fillStyle = 'rgba(20, 28, 36, 0.9)';
      ctx.strokeStyle = '#5ec8c0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(vane.x - lw / 2, vane.y - 52, lw, 22, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd94d';
      ctx.textAlign = 'center';
      ctx.fillText(label, vane.x, vane.y - 36);
      ctx.fillStyle = 'rgba(242, 234, 216, 0.75)';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText('WIND VANE', vane.x, vane.y + 38);
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
    // Coloured ground ring: the tower's footprint, readable at a glance.
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 25, 0, Math.PI * 2);
    ctx.fillStyle = def.color + '2e';
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Stone base.
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 23, 0, Math.PI * 2);
    ctx.fillStyle = '#4a5866';
    ctx.fill();
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 2;
    ctx.stroke();
    // The kite itself, turning toward its target.
    ctx.save();
    ctx.translate(tower.x, tower.y - 7);
    ctx.rotate(tower.aim || -Math.PI / 2);
    ctx.fillStyle = def.color;
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 1.5;
    if (def.shape === 'diamond' || def.shape === 'hex') {
      const r = def.shape === 'hex' ? 15 : 17;
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
      ctx.arc(0, 0, 17, -0.9, 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (def.shape === 'rod') {
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(6, 5);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 9, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff6c9';
      ctx.fill();
    } else if (def.shape === 'beacon') {
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.shape === 'flame') {
      // Ember Kite: a flame that leans into the wind.
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.quadraticCurveTo(11, -4, 8, 8);
      ctx.quadraticCurveTo(4, 14, 0, 12);
      ctx.quadraticCurveTo(-4, 14, -8, 8);
      ctx.quadraticCurveTo(-11, -4, 0, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.quadraticCurveTo(5, 0, 3, 6);
      ctx.quadraticCurveTo(0, 9, -3, 6);
      ctx.quadraticCurveTo(-5, 0, 0, -8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Kite string down to the base.
    ctx.strokeStyle = 'rgba(242, 234, 216, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y - 7);
    ctx.lineTo(tower.x, tower.y + 14);
    ctx.stroke();
    // Level pips.
    for (let i = 0; i < lvl; i++) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(tower.x - 9 + i * 9, tower.y + 28, 3, 0, Math.PI * 2);
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
    const burning = state.time < e.burnUntil;
    // Ground shadow: lifts the creature off the path so it reads at a
    // glance, even the pale Wisp.
    ctx.fillStyle = 'rgba(10, 16, 22, 0.45)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + def.radius * 0.75, def.radius * 0.9, def.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // A Mender's healing ring: green, pulsing, so the player sees the
    // priority target.
    if (def.id === 'mender') {
      const pulse = 0.25 + 0.15 * Math.sin(state.time * 4);
      ctx.strokeStyle = `rgba(139, 224, 127, ${pulse + 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, def.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.flash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
    } else if (def.id === 'wisp') {
      // The pale Wisp glows cyan so it never washes out against the path.
      ctx.shadowColor = '#7fd4ff';
      ctx.shadowBlur = 10;
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
    } else if (def.shape === 'mender') {
      // A mender: green orb with a white cross — it heals the pack.
      ctx.beginPath();
      ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2.5, -8, 5, 16);
      ctx.fillRect(-8, -2.5, 16, 5);
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
    // Burn: an Ember Kite set this one alight — orange flicker on top.
    if (burning) {
      const flick = 0.5 + 0.3 * Math.sin(state.time * 11 + e.wobble);
      ctx.fillStyle = `rgba(255, 90, 60, ${flick * 0.55})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y - def.radius * 0.3, def.radius * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(e.x, e.y - def.radius * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
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
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = 0.85;
        ctx.lineCap = 'round';
        ctx.beginPath();
        p.trail.forEach((t, i) => (i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y)));
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (p.kind === 'rod') {
        // Lightning: a jittered bright line from the shot's tail to its head.
        ctx.strokeStyle = '#fff6c9';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        const tail = p.trail[0] || { x: p.x - 20, y: p.y };
        ctx.lineTo((p.x + tail.x) / 2 + (Math.sin(p.x * 3) * 6), (p.y + tail.y) / 2);
        ctx.lineTo(tail.x, tail.y);
        ctx.stroke();
      }
      // A glowing head: the shot itself must read in a still frame, not
      // just its trail — this is what shows the wind bending the shot.
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.kind === 'rod' ? '#fff6c9' : p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'rod' ? 5 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
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
    // Fewer, shorter, fainter streaks: the wind must read, not scratch
    // the whole board white at gale strength.
    const count = Math.round(8 + strength * 14);
    ctx.strokeStyle = `rgba(242, 234, 216, ${0.1 + strength * 0.14})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < count; i++) {
      const seed = i * 137.5;
      const speed = 40 + strength * 160;
      const span = 1600;
      const t = ((state.time * speed + seed) % span) - 160;
      const lane = 90 + ((i * 53) % 580);
      const len = 20 + strength * 26;
      const x = t + lane * 0.35;
      const y = lane;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + wind.x * len, y + wind.y * len);
      ctx.stroke();
    }
    // Leaves on the wind: a few petals and dry leaves ride the gusts, so
    // the wind's direction is visible even where there are no streaks.
    ctx.fillStyle = 'rgba(255, 217, 77, 0.7)';
    for (let i = 0; i < 9; i++) {
      const seed = i * 211.3;
      const speed = 30 + strength * 120;
      const span = 1500;
      const t = ((state.time * speed + seed) % span) - 110;
      const lane = 110 + ((i * 89) % 540);
      const x = t + lane * 0.3;
      const y = lane + Math.sin(state.time * 2 + i * 1.7) * 10;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(state.time * 3 + i);
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    }
  }
}
