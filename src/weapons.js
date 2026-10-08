// Weapon behaviors. Each fused (Ascended) weapon simply runs both parents' behaviors
// with boosted stats, so every behavior reads its knobs from the effective stat block `st`.
import { T } from './atlas.js';
import { sfx } from './audio.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const PRISM = [0xff6a8a, 0xffd060, 0x6affc0, 0x6ac0ff, 0xc08aff];

export function lightning(g, x1, y1, x2, y2, tint = 0xbfe0ff, width = 1) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const n = Math.max(2, Math.min(7, Math.round(len / 40)));
  const nx = -dy / (len || 1), ny = dx / (len || 1);
  let px = x1, py = y1;
  for (let i = 1; i <= n; i++) {
    const t = i / n, off = i === n ? 0 : rand(-1, 1) * Math.min(26, len * 0.15);
    const qx = x1 + dx * t + nx * off, qy = y1 + dy * t + ny * off;
    const sl = Math.hypot(qx - px, qy - py);
    g.spawnFx(T.bolt_seg, (px + qx) / 2, (py + qy) / 2, {
      life: 0.2, s0: 1.4 * width, s1: 0.3, sx: sl / 30, rot: Math.atan2(qy - py, qx - px), tint, drag: 0,
    });
    px = qx; py = qy;
  }
  g.spawnFx(T.glow, x2, y2, { life: 0.2, s0: 0.8, s1: 0.2, tint });
}

function chainFrom(g, start, jumps, dmg, w, range, tint) {
  const hit = new Set([start.uid]);
  let cur = start;
  g.damage(cur, dmg, { w, knock: 2 });
  const tmp = [];
  for (let j = 0; j < jumps; j++) {
    tmp.length = 0;
    g.grid.query(cur.x, cur.y, range, tmp);
    let best = null, bd = 1e12;
    for (const e of tmp) {
      if (hit.has(e.uid) || e.inert) continue;
      const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) break;
    lightning(g, cur.x, cur.y - 10, best.x, best.y - 10, tint);
    hit.add(best.uid);
    g.damage(best, dmg, { w, knock: 2 });
    cur = best;
  }
}

function hitCd(S, e, now, cd) {
  const m = S.hits || (S.hits = new Map());
  const l = m.get(e.uid);
  if (l !== undefined && now - l < cd) return false;
  m.set(e.uid, now);
  if (m.size > 3000) m.clear();
  return true;
}

// Persistent particle sets (orbit blades, beams, drones) sized to `n`
function ensure(g, S, key, n, tex, layer) {
  const arr = S[key] || (S[key] = []);
  while (arr.length < n) arr.push(layer.add(tex, g.player.x, g.player.y));
  while (arr.length > n) layer.kill(arr.pop());
  return arr;
}
function killAll(g, S, key, layer) {
  if (!S[key]) return;
  for (const p of S[key]) layer.kill(p);
  S[key] = [];
}

const tmpA = [];

export const BEHAVIORS = {
  // ---------- seeking fireballs ----------
  bolt: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      S.t = (S.t ?? 0.2) - dt;
      if (S.t <= 0) {
        if (!g.nearestEnemy(P.x, P.y, 650)) { S.t = 0.15; return; }
        S.t = st.cd; S.queue = st.amount; S.qt = 0;
      }
      if (S.queue > 0) {
        S.qt -= dt;
        if (S.qt <= 0) {
          S.qt = 0.06; S.queue--;
          const tg = g.nearestEnemy(P.x, P.y, 800);
          const a = tg ? Math.atan2(tg.y - 10 - (P.y - 16), tg.x - P.x) + rand(-0.25, 0.25) : Math.random() * TAU;
          const sp = st.speed;
          g.addProjectile({
            tex: T.bolt, x: P.x, y: P.y - 16, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: st.duration,
            dmg: st.dmg, pierce: st.pierce, r: 9 * st.area, scale: (st.explode ? 1.25 : 1) * Math.sqrt(st.area), w: part.w,
            homing: 4, target: tg, explode: st.explode * st.area, trail: 0.025, trailTint: 0xff7a20, knock: st.knock,
          });
          sfx.shoot();
        }
      }
    },
  },

  // ---------- orbiting sickles ----------
  orbit: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      const perm = st.permanent || st.duration >= st.cd;
      S.t = (S.t ?? 0) - dt;
      if (!perm) {
        if (S.active > 0) { S.active -= dt; if (S.active <= 0) S.t = st.cd - st.duration; }
        else if (S.t <= 0) S.active = st.duration;
      } else S.active = 1;
      const on = S.active > 0;
      S.fade = Math.max(0, Math.min(1, (S.fade || 0) + (on ? dt * 6 : -dt * 6)));
      if (S.fade <= 0) { killAll(g, S, 'ps', g.L.projAdd); return; }
      const n = st.amount;
      const ps = ensure(g, S, 'ps', n, T.blade, g.L.projAdd);
      S.a = (S.a || 0) + dt * 3.4 * st.speed;
      const R = 82 * st.area * (0.4 + 0.6 * S.fade), br = 17 * Math.sqrt(st.area);
      for (let i = 0; i < n; i++) {
        const ring = st.permanent && i % 2 ? -1 : 1;
        const rr = st.permanent && i % 2 ? R * 1.55 : R;
        const a = S.a * ring + (i / n) * TAU;
        const x = P.x + Math.cos(a) * rr, y = P.y - 14 + Math.sin(a) * rr;
        const p = ps[i];
        p.x = x; p.y = y; p.rotation = a * 2 + S.a * 4; p.alpha = S.fade;
        p.scaleX = p.scaleY = Math.sqrt(st.area) * 1.05;
        if (!on) continue;
        tmpA.length = 0;
        g.grid.query(x, y, br, tmpA);
        for (const e of tmpA) if (hitCd(S, e, g.time, 0.35)) g.damage(e, st.dmg, { w: part.w, knock: st.knock, fx: P.x, fy: P.y });
      }
    },
    dispose(g, part) { killAll(g, part.state, 'ps', g.L.projAdd); },
  },

  // ---------- chain lightning ----------
  chain: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      S.t = (S.t ?? 0.5) - dt;
      if (S.t > 0) return;
      S.t = st.cd;
      let fired = false;
      for (let i = 0; i < st.amount; i++) {
        const e = g.randomVisibleEnemy();
        if (!e) break;
        fired = true;
        lightning(g, e.x + rand(-30, 30), e.y - 260, e.x, e.y - 10, 0xd0e8ff, 1.3);
        chainFrom(g, e, st.chains, st.dmg, part.w, 170 * st.area, 0xbfe0ff);
        if (g.fx.length < 2500) g.burst(e.x, e.y - 10, 6, [0xbfe0ff, 0xffffff], 200, 0.5);
      }
      if (fired) sfx.zap();
      else S.t = 0.2;
    },
  },

  // ---------- freezing shockwave ----------
  pulse: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      S.rings = S.rings || [];
      S.t = (S.t ?? 0.6) - dt;
      if (S.t <= 0) {
        S.t = st.cd;
        const max = 165 * st.area;
        S.rings.push({ x: P.x, y: P.y - 12, r: 0, max, hit: new Set() });
        g.shockwave(P.x, P.y - 12, 0x9ae8ff, max, 0.42);
        g.spawnFx(T.glow, P.x, P.y - 12, { life: 0.3, s0: max / 50, s1: max / 30, tint: 0x4ab0ff, a: 0.35 });
        for (let i = 0; i < 18 && g.fx.length < 2800; i++) {
          const a = (i / 18) * TAU;
          g.spawnFx(T.shard, P.x, P.y - 12, { vx: Math.cos(a) * max * 2.6, vy: Math.sin(a) * max * 2.6, life: 0.38, s0: 0.9, s1: 0.2, tint: 0xd0f4ff, rot: a, drag: 2 });
        }
        sfx.pulse();
      }
      for (let i = S.rings.length - 1; i >= 0; i--) {
        const R = S.rings[i];
        R.r += (R.max / 0.4) * dt;
        tmpA.length = 0;
        g.grid.query(R.x, R.y, R.r, tmpA);
        for (const e of tmpA) {
          if (R.hit.has(e.uid)) continue;
          R.hit.add(e.uid);
          g.damage(e, st.dmg, { w: part.w, knock: st.knock, fx: R.x, fy: R.y, freeze: st.freeze, slow: st.duration });
          if (st.zap && Math.random() < 0.18 && e.alive) chainFrom(g, e, 3, st.dmg * 0.8, part.w, 160, 0xffffff);
        }
        if (R.r >= R.max) S.rings.splice(i, 1);
      }
    },
  },

  // ---------- homing wisps ----------
  wisp: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      S.t = (S.t ?? 0.4) - dt;
      if (S.t > 0) return;
      S.t = st.cd;
      for (let i = 0; i < st.amount; i++) {
        const a = Math.random() * TAU;
        const tg = g.randomVisibleEnemy();
        g.addProjectile({
          tex: T.wisp, x: P.x, y: P.y - 18, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: st.duration,
          dmg: st.dmg, pierce: st.pierce, r: 10 * st.area, scale: Math.sqrt(st.area) * (st.explode ? 1.3 : 1), w: part.w,
          homing: 3.2, target: tg, explode: st.explode * st.area, trail: 0.04, trailTint: 0x80ffe0, knock: st.knock, fade: true,
        }).speed = st.speed;
      }
    },
  },

  // ---------- melee cleave ----------
  arc: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      S.t = (S.t ?? 0.3) - dt;
      if (S.t <= 0) { S.t = st.cd; S.queue = st.amount; S.qt = 0; S.k = 0; }
      if (!(S.queue > 0)) return;
      S.qt -= dt;
      if (S.qt > 0) return;
      S.qt = 0.11; S.queue--;
      if (S.k === 0) {
        const tg = g.nearestEnemy(P.x, P.y, 115 * st.area * 1.6);
        S.aim = tg ? Math.atan2(tg.y - (P.y - 14), tg.x - P.x) : Math.atan2(P.fy, P.fx);
      }
      const base = S.aim;
      const k = S.k++;
      const offs = [0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -3 * Math.PI / 4];
      const a = base + offs[k % offs.length];
      const R = 115 * st.area;
      const cx = P.x + Math.cos(a) * R * 0.35, cy = P.y - 14 + Math.sin(a) * R * 0.35;
      const tint = g.charId === 'reaver' ? 0xff5060 : 0xffe8e0;
      const f = g.spawnFx(T.slash, cx, cy, { life: 0.22, s0: R / 58, s1: R / 52, rot: a, tint, drag: 0 });
      if (f) f.p.scaleY *= (k % 2 ? -1 : 1);
      g.spawnFx(T.slash, cx, cy, { life: 0.12, s0: R / 64, s1: R / 60, rot: a, tint: 0xffffff, a: 0.6, drag: 0 });
      sfx.slash();
      tmpA.length = 0;
      g.grid.query(P.x, P.y - 14, R, tmpA);
      const ca = Math.cos(a), sa = Math.sin(a);
      for (const e of tmpA) {
        const dx = e.x - P.x, dy = e.y - (P.y - 14), d = Math.hypot(dx, dy) || 1;
        if ((dx * ca + dy * sa) / d > 0.25 || d < 30) {
          g.damage(e, st.dmg, { w: part.w, knock: st.knock, fx: P.x, fy: P.y });
          if (g.fx.length < 2600) g.spawnFx(T.spark, e.x, e.y - 8, { life: 0.2, s0: 1, s1: 0, tint, rot: Math.random() * 3 });
        }
      }
    },
  },

  // ---------- falling stars ----------
  meteor: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      S.falling = S.falling || [];
      S.t = (S.t ?? 0.8) - dt;
      if (S.t <= 0) {
        S.t = st.cd;
        for (let i = 0; i < st.amount; i++) {
          const e = g.randomVisibleEnemy();
          const x = e ? e.x + rand(-20, 20) : P.x + rand(-250, 250), y = e ? e.y + rand(-20, 20) : P.y + rand(-200, 200);
          const R = 70 * st.area;
          const warn = g.spawnFx(T.target, x, y, { life: 0.55 + i * 0.08, s0: R / 30, s1: R / 28, tint: 0xff6030, a: 0.7, drag: 0, add: true });
          const p = g.L.projAdd.add(T.meteor, x + 160, y - 420);
          p.scaleX = p.scaleY = 1.1 * Math.sqrt(st.area);
          S.falling.push({ x, y, t: 0.55 + i * 0.08, max: 0.55 + i * 0.08, p, R });
        }
      }
      for (let i = S.falling.length - 1; i >= 0; i--) {
        const m = S.falling[i];
        m.t -= dt;
        const k = Math.max(0, m.t / m.max);
        m.p.x = m.x + 160 * k; m.p.y = m.y - 420 * k; m.p.rotation += dt * 6;
        if (g.fx.length < 2800 && Math.random() < 0.7) g.spawnFx(T.dot, m.p.x + rand(-6, 6), m.p.y + rand(-6, 6), { life: 0.35, s0: 2, s1: 0, tint: 0xff8030, a: 0.8 });
        if (m.t <= 0) {
          g.L.projAdd.kill(m.p);
          S.falling.splice(i, 1);
          g.explodeAt(m.x, m.y, m.R, st.dmg, part.w, 0xff7a20, st.knock);
          g.shake = Math.max(g.shake, 4);
          for (let k2 = 0; k2 < 3; k2++) g.spawnFx(T.smoke, m.x + rand(-20, 20), m.y + rand(-20, 20), { life: 0.9, s0: 0.8, s1: 2, tint: 0x302430, a: 0.5, add: false, vy: -30 });
        }
      }
    },
    dispose(g, part) { for (const m of part.state.falling || []) g.L.projAdd.kill(m.p); },
  },

  // ---------- boomerang glaive ----------
  glaive: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      S.t = (S.t ?? 0.5) - dt;
      if (S.t > 0) return;
      S.t = st.cd;
      const tg = g.nearestEnemy(P.x, P.y, 700);
      const base = tg ? Math.atan2(tg.y - P.y, tg.x - P.x) : Math.atan2(P.fy, P.fx);
      for (let i = 0; i < st.amount; i++) {
        const a = base + (i - (st.amount - 1) / 2) * (TAU / Math.max(st.amount, 5));
        const sp = st.speed;
        g.addProjectile({
          tex: T.glaive, x: P.x, y: P.y - 16, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 4,
          dmg: st.dmg, pierce: 99999, r: 20 * st.area, scale: st.area, w: part.w, rehit: 0.4, spin: 16,
          returnTo: true, retT: 0.5 * st.duration, knock: st.knock, tint: st.pierceAll ? 0xffc080 : 0xffffff,
          trail: st.pierceAll ? 0.03 : 0, trailTint: 0xff9040,
        });
      }
      sfx.slash();
    },
  },

  // ---------- rotating prism beams ----------
  beam: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      const perm = st.permanent || st.duration >= st.cd;
      S.t = (S.t ?? 0.5) - dt;
      if (!perm) {
        if (S.active > 0) { S.active -= dt; if (S.active <= 0) S.t = st.cd - st.duration; }
        else if (S.t <= 0) S.active = st.duration;
      } else S.active = 1;
      const on = S.active > 0;
      S.fade = Math.max(0, Math.min(1, (S.fade || 0) + (on ? dt * 5 : -dt * 5)));
      if (S.fade <= 0) { killAll(g, S, 'ps', g.L.projAdd); return; }
      const n = st.amount;
      const ps = ensure(g, S, 'ps', n, T.beam, g.L.projAdd);
      S.a = (S.a || 0) + dt * 1.6 * st.speed;
      S.ct = (S.ct || 0) + dt;
      const len = 240 * st.area * S.fade, ox = P.x, oy = P.y - 16;
      for (let i = 0; i < n; i++) {
        const a = S.a + (i / n) * TAU;
        const p = ps[i];
        p.anchorX = 0; p.x = ox; p.y = oy; p.rotation = a;
        p.scaleX = len / 64; p.scaleY = (0.7 + Math.sin(S.ct * 20 + i) * 0.12) * Math.sqrt(st.area);
        p.tint = PRISM[(i + Math.floor(S.ct * 2)) % PRISM.length];
        p.alpha = 0.9 * S.fade;
        if (!on) continue;
        const ca = Math.cos(a), sa = Math.sin(a);
        for (let d = 24; d < len; d += 30) {
          tmpA.length = 0;
          g.grid.query(ox + ca * d, oy + sa * d, 14 * Math.sqrt(st.area), tmpA);
          for (const e of tmpA) if (hitCd(S, e, g.time, 0.22)) g.damage(e, st.dmg, { w: part.w, knock: st.knock });
        }
        if (g.fx.length < 2600 && Math.random() < dt * 20) {
          const d = rand(30, len);
          g.spawnFx(T.spark, ox + ca * d, oy + sa * d, { life: 0.3, s0: 0.6, s1: 0, tint: p.tint, vx: rand(-40, 40), vy: rand(-40, 40) });
        }
      }
    },
    dispose(g, part) { killAll(g, part.state, 'ps', g.L.projAdd); },
  },

  // ---------- blossom mines ----------
  mine: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      S.mines = S.mines || [];
      S.t = (S.t ?? 0.5) - dt;
      if (S.t <= 0) {
        S.t = st.cd;
        for (let i = 0; i < st.amount; i++) {
          if (S.mines.length > 70) { const old = S.mines.shift(); g.L.proj.kill(old.p); }
          const a = Math.random() * TAU, d = rand(30, 150);
          const x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
          const p = g.L.proj.add(T.mine, x, y);
          S.mines.push({ x, y, arm: 0.45, life: st.duration, p, t: Math.random() * 5 });
        }
      }
      const R = 75 * st.area;
      for (let i = S.mines.length - 1; i >= 0; i--) {
        const m = S.mines[i];
        m.arm -= dt; m.life -= dt; m.t += dt;
        const s = m.arm > 0 ? 0.5 + (0.45 - m.arm) : 1 + Math.sin(m.t * 6) * 0.08;
        m.p.scaleX = m.p.scaleY = s * Math.sqrt(st.area); m.p.rotation = m.t * 0.6;
        let boom = m.life <= 0;
        if (!boom && m.arm <= 0) {
          tmpA.length = 0;
          g.grid.query(m.x, m.y, 22, tmpA);
          for (const e of tmpA) if (!e.inert) { boom = true; break; }
        }
        if (boom) {
          g.L.proj.kill(m.p);
          S.mines.splice(i, 1);
          g.explodeAt(m.x, m.y, R, st.dmg, part.w, 0xff6ab0, st.knock);
          for (let k = 0; k < 8 && g.fx.length < 2800; k++) {
            const a = Math.random() * TAU;
            g.spawnFx(T.dot, m.x, m.y, { vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 0.6, s0: 1.4, s1: 0, tint: 0xffa0d0, grav: 300 });
          }
        }
      }
    },
    dispose(g, part) { for (const m of part.state.mines || []) g.L.proj.kill(m.p); },
  },

  // ---------- hovering drones ----------
  drone: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      const n = st.amount;
      const ps = ensure(g, S, 'ps', n, T.drone, g.L.proj);
      S.d = S.d || [];
      S.a = (S.a || 0) + dt * 1.3;
      for (let i = 0; i < n; i++) {
        const d = S.d[i] || (S.d[i] = { x: P.x, y: P.y, t: Math.random() * st.cd });
        const a = S.a + (i / n) * TAU;
        const tx = P.x + Math.cos(a) * 62, ty = P.y - 34 + Math.sin(a) * 30;
        d.x += (tx - d.x) * Math.min(1, dt * 5); d.y += (ty - d.y) * Math.min(1, dt * 5);
        const p = ps[i];
        p.x = d.x; p.y = d.y + Math.sin(g.time * 5 + i) * 3;
        d.t -= dt;
        if (d.t <= 0) {
          const tg = g.nearestEnemy(d.x, d.y, 480);
          if (!tg) { d.t = 0.2; continue; }
          d.t = st.cd;
          const ang = Math.atan2(tg.y - 8 - d.y, tg.x - d.x);
          g.addProjectile({
            tex: T.bolt, x: d.x, y: d.y, vx: Math.cos(ang) * st.speed, vy: Math.sin(ang) * st.speed, life: 1.1,
            dmg: st.dmg, pierce: st.pierce, r: 7, scale: 0.55, w: part.w, tint: 0x80f0ff, knock: st.knock,
          });
          g.spawnFx(T.glow, d.x, d.y, { life: 0.1, s0: 0.4, s1: 0.1, tint: 0x80f0ff });
        }
      }
      while (S.d.length > n) S.d.pop();
    },
    dispose(g, part) { killAll(g, part.state, 'ps', g.L.proj); },
  },

  // ---------- burning aura ----------
  aura: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      const R = 78 * st.area;
      const ps = ensure(g, S, 'ps', 2, T.aura, g.L.projAdd);
      S.a = (S.a || 0) + dt;
      ps[0].x = ps[1].x = P.x; ps[0].y = ps[1].y = P.y - 10;
      ps[0].scaleX = ps[0].scaleY = R / 72; ps[0].rotation = S.a * 0.8; ps[0].tint = 0xff9a30; ps[0].alpha = 0.75;
      ps[1].scaleX = ps[1].scaleY = (R / 72) * 0.92; ps[1].rotation = -S.a * 1.3; ps[1].tint = 0xffd060; ps[1].alpha = 0.45;
      if (g.fx.length < 2600 && Math.random() < dt * 30) {
        const a = Math.random() * TAU, d = R * rand(0.7, 1);
        g.spawnFx(T.dot, P.x + Math.cos(a) * d, P.y - 10 + Math.sin(a) * d, { life: 0.5, s0: 1.2, s1: 0, tint: 0xff8030, vy: -50, a: 0.8 });
      }
      S.t = (S.t ?? 0) - dt;
      if (S.t > 0) return;
      S.t = st.cd;
      tmpA.length = 0;
      g.grid.query(P.x, P.y - 10, R, tmpA);
      for (const e of tmpA) g.damage(e, st.dmg, { w: part.w, knock: st.knock, fx: P.x, fy: P.y });
    },
    dispose(g, part) { killAll(g, part.state, 'ps', g.L.projAdd); },
  },

  // ---------- piercing icicles in facing direction ----------
  lance: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      S.t = (S.t ?? 0.3) - dt;
      if (S.t <= 0) { S.t = st.cd; S.queue = st.amount; S.qt = 0; }
      if (!(S.queue > 0)) return;
      S.qt -= dt;
      if (S.qt > 0) return;
      S.qt = 0.05; S.queue--;
      const a = Math.atan2(P.fy, P.fx) + rand(-0.12, 0.12);
      g.addProjectile({
        tex: T.icicle, layer: g.L.proj, x: P.x, y: P.y - 16, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed,
        life: st.duration, dmg: st.dmg, pierce: st.pierce, r: 9 * st.area, scale: 1.1 * Math.sqrt(st.area), w: part.w,
        faceVel: true, freeze: st.freeze, slow: 1.2, knock: st.knock, trail: 0.03, trailTint: 0xa0e8ff,
      });
      sfx.shoot();
    },
  },

  // ---------- radial quill burst ----------
  radial: {
    update(g, part, st, dt) {
      const S = part.state, P = g.player;
      S.t = (S.t ?? 0.6) - dt;
      if (S.t > 0) return;
      S.t = st.cd;
      const n = st.amount, off = Math.random() * TAU;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU;
        g.addProjectile({
          tex: T.feather, x: P.x, y: P.y - 16, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed,
          life: st.duration, dmg: st.dmg, pierce: st.pierce, r: 9 * st.area, scale: Math.sqrt(st.area), w: part.w,
          faceVel: true, freeze: st.freeze, knock: st.knock, fade: true, tint: st.freeze ? 0xc0f0ff : 0xffffff,
        });
      }
      g.spawnFx(T.glow, P.x, P.y - 16, { life: 0.2, s0: 0.6, s1: 1.6, tint: 0xfff0c0, a: 0.6 });
      sfx.shoot();
    },
  },
};
