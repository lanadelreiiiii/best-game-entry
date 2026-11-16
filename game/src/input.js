// KITEWARDEN — mouse and keyboard input. Pointer clicks hit-test the HUD
// layout first (buttons, menus, cards), then the world (wind vanes, then
// build nodes, then towers); keys drive the same actions the buttons do,
// so every control works twice — once by mouse, once by keyboard.
// Vanes are hit-tested before nodes: a vane never sits on a node, but the
// order keeps a vane click from ever opening a build menu by accident.

import { hudLayout, inRect } from './hud.js';
import { NODE_RADIUS } from './ridge.js';
import { TOWER_ORDER } from './towers.js';
import { VANE_CLICK_RADIUS } from './vanes.js';

export class Input {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.hover = { x: -1, y: -1 };
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 1280,
      y: ((e.clientY - r.top) / r.height) * 720,
    };
  }

  onPointerMove(e) {
    this.hover = this.pos(e);
    this.game.state.hover = this.hover; // the renderer reads this for vane hover rings
  }

  onPointerDown(e) {
    const game = this.game;
    const state = game.state;
    game.audio.ensure();
    const { x, y } = this.pos(e);
    const layout = hudLayout(state);

    // Title screen: the start button (or anywhere) begins the run.
    if (state.phase === 'title') {
      game.startGame();
      return;
    }
    if (state.phase === 'victory') {
      if (inRect(layout.victoryEndless, x, y)) return game.continueEndless();
      if (inRect(layout.victoryRestart, x, y)) return game.restart();
      return;
    }
    if (state.phase === 'gameover') {
      if (inRect(layout.gameoverRestart, x, y)) return game.restart();
      return;
    }
    // Blessing choice: cards first (keys 1-3 also work).
    if (state.phase === 'blessing') {
      for (const card of layout.blessingCards) {
        if (inRect(card.r, x, y)) return game.chooseBlessing(card.index);
      }
      return;
    }

    // HUD buttons.
    if (inRect(layout.startWave, x, y)) return game.startWave();
    if (inRect(layout.speed, x, y)) return game.toggleSpeed();
    if (inRect(layout.pause, x, y)) return game.togglePause();
    if (inRect(layout.mute, x, y)) return game.toggleMute();

    // Build menu buttons.
    for (const item of layout.buildMenu) {
      if (inRect(item.r, x, y)) {
        return game.buildAt(state.selection.id, item.id);
      }
    }
    // Tower panel buttons.
    if (layout.towerPanel) {
      if (layout.towerPanel.upgrade && inRect(layout.towerPanel.upgrade, x, y)) {
        return game.upgradeSelected();
      }
      if (inRect(layout.towerPanel.sell, x, y)) return game.sellSelected();
    }

    // World: a wind vane first — click it to turn the local wind, free,
    // any time during play. Then a tower (it sits on its node), then an
    // empty node.
    for (const vane of state.vanes.all()) {
      if (Math.hypot(x - vane.x, y - vane.y) < VANE_CLICK_RADIUS) {
        return game.rotateVane(vane.id);
      }
    }
    for (const node of state.nodes) {
      if (node.tower && Math.hypot(x - node.x, y - node.y) < NODE_RADIUS + 4) {
        return game.selectTower(node.id);
      }
    }
    for (const node of state.nodes) {
      if (Math.hypot(x - node.x, y - node.y) < NODE_RADIUS + 4) {
        return game.selectNode(node.id);
      }
    }
    // Clicked empty ground: close the panels.
    game.clearSelection();
  }

  onKey(e) {
    const game = this.game;
    const state = game.state;
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === 'm') return game.toggleMute();
    if (key === 'r') return game.restart();
    if (key === ' ') {
      e.preventDefault();
      if (state.phase === 'title') return game.startGame();
      return game.togglePauseOrStart();
    }
    if (key === 'f') return game.toggleSpeed();
    if (key === 'escape') return game.clearSelection();
    // Number keys: blessing choice, or tower type, or quick-build.
    const num = parseInt(key, 10);
    if (num >= 1 && num <= 5) {
      if (state.phase === 'blessing') return game.chooseBlessing(num - 1);
      if (state.phase === 'playing') {
        game.setBuildType(TOWER_ORDER[num - 1]);
        if (state.selection && state.selection.kind === 'node') {
          return game.buildAt(state.selection.id, TOWER_ORDER[num - 1]);
        }
      }
    }
  }
}
