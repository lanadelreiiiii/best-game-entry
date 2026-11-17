// KITEWARDEN — combat: towers acquire targets, fire, and their shots fly
// with the wind; hits pay gold, split Shearlings, and shake the ridge when
// a boss falls. Projectiles and particles live in fixed pools — the hot
// loop allocates nothing new while a wave is running.
//
// The wind a shot feels is the LOCAL wind (wind.localWindAt): inside a
// wind vane's ring the shots bend toward the direction the player turned
// that vane to, and a tower's downwind range bonus is judged on the wind
// halfway between the tower and its target — the wind the shot actually
// flies through. Outside every ring the local wind IS the global wind,
// so nothing about the old balance changes there.
//
// Enemies walk one of two lanes past the fork (see ridge.js). Both lanes
// are the same length, so `dist` means the same thing on either one and
// towers still target the enemy furthest along, whichever lane it is on.
// A Scout Kite re-decides at the fork: it takes the lane with fewer
// towers in range of it, with a seeded tiebreak.

import { towerStats } from './towers.js';
import { pointAlongPath, ridgeLength, FORK_DIST, distanceToLane } from './ridge.js';
import { drawBlessings, waveClearBonus, TOTAL_WAVES, spawnEnemy } from './waves.js';

const PATH_LEN = ridgeLength();

const PROJECTILE_POOL = 240;
const PARTICLE_POOL = 320;

export class Combat {
  constructor(state) {
    this.s = state;
    this.projectilePool = [];
    for (let i = 0; i < PROJECTILE_POOL; i++) {
      this.projectilePool.push({ active: false });
    }
    this.particlePool = [];
    for (let i = 0; i < PARTICLE_POOL; i++) {
      this.particlePool.push({ active: false });
    }
  }

  // One fixed-step tick: towers fire, shots fly, enemies walk, spawns arrive.
  step(dt) {
    const s = this.s;
    s.wind.tick(s.tick);
    this.updateSpawns(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updateParticles(dt);
    this.updateFloaters(dt);
    if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 30);
  }

  updateSpawns(dt) {
    const s = this.s;
    if (s.waveState !== 'spawning' && s.waveState !== 'fighting') return;
    if (s.spawnQueue.length === 0) {
      if (s.waveState === 'spawning') s.waveState = 'fighting';
      return;
    }
    s.spawnTimer -= dt;
    while (s.spawnQueue.length > 0 && s.spawnTimer <= 0) {
      const next = s.spawnQueue[0];
      const enemy = next.enemy;
      // The trunk is shared, so every spawn starts at the same point
      // whatever lane it will take past the fork.
      const pos = pointAlongPath(0, enemy.lane);
      enemy.x = pos.x;
      enemy.y = pos.y;
      enemy.angle = pos.angle;
      s.enemies.push(enemy);
      s.spawnQueue.shift();
      s.spawnTimer += next.gap;
    }
  }

  // Each tower picks the enemy furthest along the path inside its (wind
  // adjusted) range, and fires when its cooldown is up.
  updateTowers(dt) {
    const s = this.s;
    for (const tower of s.towers()) {
      if (tower.def.id === 'beacon') continue;
      tower.cooldown -= dt;
      const stats = towerStats(tower.def, tower.level, s.buffsFor(tower.node));
      tower.stats = stats; // kept for the renderer and the tower panel
      const range = stats.range * (1 + s.mods.range);
      let best = null;
      let bestDist = -1;
      for (const e of s.enemies) {
        if (e.dead || e.leaked) continue;
        const d = Math.hypot(e.x - tower.x, e.y - tower.y);
        if (d > range) continue;
        if (e.dist > bestDist) {
          bestDist = e.dist;
          best = e;
        }
      }
      tower.target = best;
      if (!best) continue;
      const aim = Math.atan2(best.y - tower.y, best.x - tower.x);
      tower.aim = aim;
      // Range check again with the local wind: a downwind shot reaches
      // farther, judged on the wind halfway to the target — the wind the
      // shot flies through, vane ring included.
      const midX = (tower.x + best.x) / 2;
      const midY = (tower.y + best.y) / 2;
      const reach = range * s.wind.rangeMultiplierAt(aim, midX, midY);
      if (Math.hypot(best.x - tower.x, best.y - tower.y) > reach) continue;
      if (tower.cooldown > 0) continue;
      tower.cooldown = 1 / (stats.rate * (1 + s.mods.rate));
      this.fire(tower, best, stats);
    }
  }

  fire(tower, target, stats) {
    const s = this.s;
    s.stats.shots++;
    const p = this.projectilePool.find((q) => !q.active);
    if (!p) return;
    const speed = tower.def.projectileSpeed * (1 + s.mods.projectileSpeed);
    const aim = Math.atan2(target.y - tower.y, target.x - tower.x);
    Object.assign(p, {
      active: true,
      kind: tower.def.id,
      tower,
      x: tower.x,
      y: tower.y - 14,
      vx: Math.cos(aim) * speed,
      vy: Math.sin(aim) * speed,
      speed,
      damage: stats.damage,
      target,
      trail: [],
      chain: (stats.chain || 0) + s.mods.chain,
      knockback: stats.knockback || 0,
      slowFactor: stats.slowFactor || 0,
      slowTime: stats.slowTime || 0,
      burnDps: stats.burnDps || 0,
      burnTime: stats.burnTime || 0,
      life: 2.5,
      windCatch: Math.max(0, tower.def.windCatch + s.mods.windCatch),
      color: tower.def.color,
    });
    s.audio?.shoot(tower.def.id);
  }

  updateProjectiles(dt) {
    const s = this.s;
    for (const p of this.projectilePool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      // The LOCAL wind bends the shot: sideways acceleration along the
      // wind at the shot's own position, so a shot crossing a turned
      // vane's ring curves away from the global wind while it is inside.
      const local = s.wind.localWindAt(p.x, p.y);
      const push = local.strength * p.windCatch * 26 * dt;
      p.vx += Math.cos(local.angle) * push;
      p.vy += Math.sin(local.angle) * push;
      // Gentle steering keeps a bent shot on its target instead of lost.
      if (p.target && !p.target.dead && !p.target.leaked) {
        const want = Math.atan2(p.target.y - p.y, p.target.x - p.x);
        const have = Math.atan2(p.vy, p.vx);
        let diff = want - have;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
        const na = have + turn;
        const sp = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(na) * sp;
        p.vy = Math.sin(na) * sp;
      }
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 40) p.trail.shift(); // a long tail shows the wind bending the shot
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.target && !p.target.dead && !p.target.leaked) {
        const d = Math.hypot(p.target.x - p.x, p.target.y - p.y);
        if (d < p.target.def.radius + 7) {
          this.hit(p, p.target);
          p.active = false;
        }
      } else if (p.x < -30 || p.x > 1310 || p.y < -30 || p.y > 750) {
        p.active = false;
      }
    }
    s.projectiles = this.projectilePool.filter((p) => p.active);
  }

  hit(p, enemy) {
    const s = this.s;
    s.stats.hits++;
    this.damage(enemy, p.damage, p);
    if (p.kind === 'rod' && p.chain > 0) {
      // Lightning chains to the nearest other enemies in range.
      let chained = 0;
      const near = s.enemies
        .filter((e) => e !== enemy && !e.dead && !e.leaked)
        .map((e) => ({ e, d: Math.hypot(e.x - enemy.x, e.y - enemy.y) }))
        .filter((o) => o.d < 130)
        .sort((a, b) => a.d - b.d);
      for (const { e } of near) {
        if (chained >= p.chain) break;
        this.damage(e, p.damage * 0.7, p);
        this.burst(e.x, e.y, '#ffd94d', 6);
        chained++;
      }
    }
    if (p.knockback > 0 && !enemy.def.knockbackImmune && !enemy.dead) {
      const wind = s.wind.vector();
      enemy.dist = Math.max(0, enemy.dist - p.knockback);
      const pos = pointAlongPath(enemy.dist, enemy.lane);
      enemy.x = pos.x + wind.x * 4;
      enemy.y = pos.y + wind.y * 4;
    }
    if (p.slowFactor > 0 && !enemy.dead) {
      enemy.slowFactor = p.slowFactor;
      enemy.slowUntil = s.time + p.slowTime;
    }
    if (p.burnDps > 0 && !enemy.dead) {
      // Ember burn: the strongest flame wins, and every hit re-lights it.
      enemy.burnDps = Math.max(enemy.burnDps, p.burnDps);
      enemy.burnUntil = s.time + p.burnTime;
    }
  }

  // Damage one enemy; handles death, rewards, splitting and boss shakes.
  damage(enemy, amount, source) {
    const s = this.s;
    if (enemy.dead || enemy.leaked) return;
    enemy.hp -= amount;
    enemy.flash = 0.12;
    this.burst(enemy.x, enemy.y, '#ffffff', 3);
    if (enemy.hp > 0) return;
    enemy.dead = true;
    s.kills++;
    if (source && source.tower) source.tower.kills++;
    const reward = Math.round(enemy.reward * (1 + s.mods.reward));
    s.gold += reward;
    s.earned += reward;
    s.score += enemy.def.boss ? 500 : 10;
    this.floater(enemy.x, enemy.y - 18, `+${reward}`, '#ffd94d');
    this.burst(enemy.x, enemy.y, enemy.def.color, enemy.def.boss ? 26 : 10);
    s.audio?.kill(enemy.def.boss);
    if (enemy.def.boss) {
      s.shake = 14;
      s.banner('The Storm Serpent falls! The ridge holds.', 4);
    }
    if (enemy.def.splitsInto) {
      // A Shearling comes apart into wisps, slightly behind it. The
      // children are spawned through the same seeded path as any enemy,
      // and they stay on the parent's lane — a split never teleports an
      // enemy across the fork.
      for (let i = 0; i < enemy.def.splitCount; i++) {
        const child = spawnEnemy(enemy.def.splitsInto, s.wave, s.spawnCounter++, enemy.lane);
        child.dist = Math.max(0, enemy.dist - 14 - i * 10);
        child.forked = enemy.forked;
        const pos = pointAlongPath(child.dist, child.lane);
        child.x = pos.x;
        child.y = pos.y;
        s.enemies.push(child);
      }
    }
  }

  // How many attacking towers can reach one lane past the fork: a tower
  // defends a lane when its current range reaches any point of that lane.
  // Beacons don't shoot, so they never count as defence.
  towersOnLane(lane) {
    const s = this.s;
    let n = 0;
    for (const tower of s.towers()) {
      if (tower.def.id === 'beacon') continue;
      const range = tower.stats.range * (1 + s.mods.range);
      if (distanceToLane(lane, tower.x, tower.y) <= range) n++;
    }
    return n;
  }

  // The Scout Kite's choice at the fork: the lane with fewer towers in
  // range. A tie is broken by the run's seeded generator, so the same
  // seed always sends the same scout down the same lane.
  chooseScoutLane() {
    const s = this.s;
    const ridge = this.towersOnLane('ridge');
    const valley = this.towersOnLane('valley');
    if (ridge < valley) return 'ridge';
    if (valley < ridge) return 'valley';
    return s.rng() < 0.5 ? 'ridge' : 'valley';
  }

  updateEnemies(dt) {
    const s = this.s;
    // Menders heal the pack around them — the healing is part of the sim,
    // so it runs before anyone moves or dies this tick.
    for (const m of s.enemies) {
      if (m.dead || m.leaked || m.def.id !== 'mender') continue;
      for (const e of s.enemies) {
        if (e === m || e.dead || e.leaked) continue;
        if (e.hp >= e.maxHp) continue;
        if (Math.hypot(e.x - m.x, e.y - m.y) <= m.def.healRadius) {
          e.hp = Math.min(e.maxHp, e.hp + m.def.healRate * dt);
        }
      }
    }
    for (const e of s.enemies) {
      if (e.dead || e.leaked) continue;
      // Ember burn: damage over time, and it can finish the kill.
      if (s.time < e.burnUntil && e.burnDps > 0) {
        e.hp -= e.burnDps * dt;
        if (e.hp <= 0) {
          this.damage(e, 0, null);
          continue;
        }
      }
      const slowed = s.time < e.slowUntil ? e.slowFactor : 1;
      const speed = e.def.speed * slowed;
      e.dist += speed * dt;
      // The fork: a Scout Kite reaching the fork node re-decides its lane
      // on the spot, from the towers standing now. Every other enemy keeps
      // the lane its wave assigned it. Both lanes start at the same point,
      // so the switch never jumps the scout.
      if (e.def.id === 'scout' && !e.forked && e.dist >= FORK_DIST) {
        e.lane = this.chooseScoutLane();
        e.forked = true;
      }
      const pos = pointAlongPath(e.dist, e.lane);
      e.x = pos.x + Math.sin(s.time * 3 + e.wobble) * 2;
      e.y = pos.y + Math.cos(s.time * 2.4 + e.wobble) * 2;
      e.angle = pos.angle;
      if (e.flash > 0) e.flash -= dt;
      if (e.dist >= PATH_LEN) {
        e.leaked = true;
        s.lives -= e.def.lives;
        s.leaks++;
        s.shake = Math.max(s.shake, 6);
        this.floater(e.x - 20, e.y - 24, `-${e.def.lives} ♥`, '#ff6b6b');
        s.audio?.leak();
        if (s.lives <= 0) {
          s.lives = 0;
          s.phase = 'gameover';
          s.waveState = 'idle';
        }
      }
    }
    s.enemies = s.enemies.filter((e) => !e.dead && !e.leaked);
    // Wave cleared: nothing left alive and nothing left to spawn.
    if (
      s.waveState === 'fighting' &&
      s.spawnQueue.length === 0 &&
      s.enemies.length === 0 &&
      s.phase === 'playing'
    ) {
      this.completeWave();
    }
  }

  completeWave() {
    const s = this.s;
    s.waveState = 'done';
    const bonus = waveClearBonus(s.wave);
    s.gold += bonus;
    s.earned += bonus;
    s.score += s.wave * 100;
    s.audio?.waveClear();
    if (s.wave >= TOTAL_WAVES) {
      s.phase = 'victory';
      s.banner('The ridge holds. Twenty waves, and the storm breaks.', 6);
      return;
    }
    if (s.wave % 5 === 0) {
      s.phase = 'blessing';
      s.blessingOffer = drawBlessings(s.rng);
    } else {
      s.banner(`Wave ${s.wave} cleared — +${bonus} gold. The wind is turning…`, 3);
    }
  }

  updateParticles(dt) {
    const s = this.s;
    for (const p of this.particlePool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;
    }
    s.particles = this.particlePool.filter((p) => p.active);
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const p = this.particlePool.find((q) => !q.active);
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      Object.assign(p, {
        active: true,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.75,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  floater(x, y, text, color) {
    const s = this.s;
    s.floaters.push({ x, y, text, color, life: 1.1 });
    if (s.floaters.length > 24) s.floaters.shift();
  }

  updateFloaters(dt) {
    const s = this.s;
    for (const f of s.floaters) {
      f.life -= dt;
      f.y -= 26 * dt;
    }
    s.floaters = s.floaters.filter((f) => f.life > 0);
  }
}
