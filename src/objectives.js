// Stage objectives: every stage has one visible goal that must be accomplished, and the Eclipse Tyrant is
// warded (nearly unhurtable) until it is done, so a run is never a blind countdown.
//
// Each objective type is a factory (game, config) -> object with:
//   count/n/done/doneAt   progress
//   update(dt)            per-frame logic
//   onKill(enemy)         react to kills
//   spawnMul()            multiplier on the horde (objective pressure rules)
//   slowAt(P)             ground slow (1 = none) from objective zones
//   exempt                true while standing in a zone is part of the task (the Gloam does not settle)
//   hud()                 { title, count, prog, sub, state } for the permanent HUD block
//   targets()             [{x, y}] for the off-screen arrows
//   botTargets()          [{x, y, r, v, camp, k}] for the simulation bots
//   draw(gfx)             world-space drawing
import { T } from './atlas.js';
import { sfx } from './audio.js';
import { WAVES } from './data.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const tex = (n) => T[n] || T.glow;
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function addSpr(g, name, x, y, anchorY = 0.85, scale = 1) {
  const p = g.L.pickups.add(tex(name), x, y);
  p.anchorY = anchorY; p.scaleX = p.scaleY = scale;
  return p;
}
const killSpr = (g, p) => { if (p) g.L.pickups.kill(p); };
const spot = (P, min, max) => { const a = Math.random() * TAU, d = rand(min, max); return { x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d }; };
function ring(gfx, x, y, r, color, fill, alpha = 1) {
  gfx.circle(x, y, r).fill({ color, alpha: fill * alpha }).stroke({ color, width: 3, alpha: 0.75 * alpha });
}
function arcProg(gfx, x, y, r, prog, color) {
  if (prog <= 0) return;
  gfx.moveTo(x + r + 8, y);
  gfx.arc(x, y, r + 8, 0, Math.min(1, prog) * TAU).stroke({ color, width: 6, alpha: 0.95 });
}
// standing-in-a-zone credit is capped so the exemption from "the Gloam settles" cannot be farmed
const makeExempt = () => {
  let t = 0;
  return { tick(active, dt) { t = active ? t + dt : Math.max(0, t - dt * 0.5); return active && t < 9; } };
};
function ringOfFoes(g, scale = 1) {
  const pool = Object.keys(WAVES[g.waveIdx].pool);
  g.runEvent({ type: 'ring', enemy: pool[(Math.random() * pool.length) | 0], count: Math.round((16 + Math.floor(g.time / 40)) * scale) });
}

function base(g, cfg) {
  return { cfg, n: cfg.n, count: 0, done: false, doneAt: null, exempt: false, title: cfg.title };
}
// one task finished: reward handled by the caller, completion handled here
function bump(o, g, msg) {
  o.count++;
  if (o.count >= o.n && !o.done) {
    o.done = true; o.doneAt = g.time;
    g.onObjectiveDone();
  } else {
    g.ui.toast(`${msg} ${o.count}/${o.n}`, 'fusion');
    sfx.chestOpen();
  }
}

// ---------- KINDLE: channel waystones scattered across the map (Gloam) ----------
function kindle(g, cfg) {
  const o = base(g, cfg);
  const ex = makeExempt();
  let stone = null;
  o.update = (dt) => {
    const P = g.player;
    if (!stone && o.count < o.n && g.time >= cfg.at[o.count] && !g.boss) {
      const s = cfg.dirs ? { x: Math.cos(cfg.dirs[o.count]) * cfg.dist, y: Math.sin(cfg.dirs[o.count]) * cfg.dist } : spot(P, 700, 1100);
      stone = { x: s.x, y: s.y, r: 160, prog: 0, t: 0, spr: addSpr(g, 'waystone0', s.x, s.y) };
      g.ui.toast(cfg.dirs ? 'A WAYMARK STIRS far across the wilds: follow the arrow' : 'A WAYSTONE STIRS: follow the arrow', 'pickup');
      sfx.shrineSpawn();
    }
    o.exempt = false;
    if (!stone) return;
    stone.t += dt;
    const inside = Math.hypot(P.x - stone.x, P.y - stone.y) < stone.r;
    stone.prog = Math.max(0, Math.min(1, stone.prog + (inside ? dt / (cfg.chan || 5) : -dt * 0.05)));
    o.exempt = ex.tick(inside && stone.prog < 1, dt);
    stone.spr.texture = tex(stone.prog > 0 && ((stone.t * 4) | 0) % 2 ? 'waystone1' : 'waystone0');
    if (inside && stone.prog < 1) sfx.shrineTick(stone.prog);
    if (stone.prog >= 1) {
      g.dropPickup('chest', stone.x, stone.y, 1);
      g.heal(g.stats.maxHp * 0.15, true);
      g.burst(stone.x, stone.y, 50, [0xffa040, 0xffe080, 0xffffff], 480, 1);
      g.shockwave(stone.x, stone.y, 0xffa040, 420, 0.6);
      stone.spr.texture = tex('waystone1');
      const sp = stone.spr; setTimeout(() => killSpr(g, sp), 2500);
      stone = null;
      ringOfFoes(g, 1);
      bump(o, g, cfg.dirs ? 'WAYMARK LIT' : 'WAYSTONE KINDLED');
    }
  };
  o.onKill = () => {};
  o.spawnMul = () => 1;
  o.slowAt = () => 1;
  o.hud = () => {
    if (o.done) return { title: o.title, count: `${o.n}/${o.n}`, prog: 1, sub: cfg.dirs ? 'The road is lit' : 'All waystones blaze', state: 'done' };
    const next = o.count < o.n ? cfg.at[o.count] : 0;
    return {
      title: o.title, count: `${o.count}/${o.n}`, prog: stone ? stone.prog : 0,
      sub: stone ? (cfg.dirs ? 'Journey to the waymark, then stand in its ring' : 'Stand in the ring to kindle it (keep moving inside)') : `The next ${cfg.dirs ? 'waymark' : 'waystone'} stirs at ${fmt(next)}`, state: '',
    };
  };
  o.targets = () => (stone ? [stone] : []);
  o.botTargets = () => (stone ? [{ x: stone.x, y: stone.y, r: stone.r * 0.9, v: 5, camp: true, k: stone }] : []);
  o.draw = (gfx) => {
    if (!stone) return;
    ring(gfx, stone.x, stone.y, stone.r, 0xffa040, 0.07);
    arcProg(gfx, stone.x, stone.y, stone.r, stone.prog, 0xffd060);
  };
  return o;
}

// ---------- NESTS: quench the Cinder Forges that keep spewing imps (Ashfields) ----------
function nests(g, cfg) {
  const o = base(g, cfg);
  const forges = [];
  let spawned = 0, relief = 0;
  o.update = (dt) => {
    const P = g.player;
    while (spawned < o.n && g.time >= cfg.at[spawned] && !g.boss) {
      const s = spot(P, 1000, 1400);
      const e = g.spawnEnemy('forge', s.x, s.y, { force: true });
      if (!e) break;
      e.nestT = 2;
      forges.push(e); spawned++;
      g.ui.toast('A CINDER FORGE IGNITES: quench it', 'warn');
      sfx.bossWarn();
    }
    relief = Math.max(0, relief - dt);
    for (const e of forges) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - P.x, e.y - P.y) < 900 && !g.boss) {
        e.nestT -= dt;
        if (e.nestT <= 0) {
          e.nestT = 4;
          for (let i = 0; i < 3; i++) g.spawnEnemy('imp', e.x + rand(-50, 50), e.y + rand(-50, 50), { force: true });
          g.burst(e.x, e.y, 10, [0xff7a30, 0xffd060], 160, 0.7);
        }
      }
    }
  };
  o.onKill = (e) => {
    if (!e.d.nest) return;
    relief = 30;
    g.dropPickup('magnet', e.x, e.y, 1);
    g.burst(e.x, e.y, 60, [0xff7a30, 0xffd060, 0xffffff], 520, 1.1);
    g.shockwave(e.x, e.y, 0xff7a30, 380, 0.5);
    bump(o, g, 'FORGE QUENCHED');
  };
  o.spawnMul = () => (relief > 0 ? 0.85 : 1);
  o.slowAt = () => 1;
  const alive = () => forges.filter((e) => e.alive);
  o.hud = () => {
    if (o.done) return { title: o.title, count: `${o.n}/${o.n}`, prog: 1, sub: 'Every forge is cold', state: 'done' };
    const a = alive();
    const P = g.player;
    let near = null, nd = Infinity;
    for (const e of a) { const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < nd) { nd = d; near = e; } }
    const next = spawned < o.n ? cfg.at[spawned] : 0;
    return {
      title: o.title, count: `${o.count}/${o.n}`, prog: near ? 1 - near.hp / near.maxHp : 0,
      sub: a.length ? `${a.length} forge${a.length > 1 ? 's' : ''} burning: smash them (they breed imps)` : `The next forge ignites at ${fmt(next)}`, state: '',
    };
  };
  o.targets = () => alive();
  o.botTargets = () => alive().map((e) => ({ x: e.x, y: e.y, r: 300, v: 4, camp: true, k: e }));
  o.draw = (gfx) => {
    for (const e of forges) if (e.alive) { gfx.circle(e.x, e.y, 70).fill({ color: 0xff6020, alpha: 0.08 }); }
  };
  return o;
}

// ---------- CARRY: bear the Heartflame from the Hearthstone to frozen braziers (Rimewood) ----------
function carry(g, cfg) {
  const o = base(g, cfg);
  const ex = makeExempt();
  let state = 'wait', stone = null, brazier = null, gutter = 0, chan = 0, flameSpr = null;
  const clear = () => { killSpr(g, stone && stone.spr); killSpr(g, brazier && brazier.spr); killSpr(g, flameSpr); stone = brazier = flameSpr = null; };
  o.update = (dt) => {
    const P = g.player;
    o.exempt = false;
    if (state === 'wait') {
      if (o.count < o.n && g.time >= cfg.at[o.count] && !g.boss) {
        const s = spot(P, 280, 480);
        stone = { x: s.x, y: s.y, r: 70, spr: addSpr(g, 'hearthstone', s.x, s.y) };
        flameSpr = addSpr(g, 'heartflame', s.x, s.y - 26, 0.5);
        state = 'stone';
        g.ui.toast('THE HEARTHSTONE WAKES: take its flame', 'pickup');
        sfx.shrineSpawn();
      }
      return;
    }
    if (state === 'stone') {
      if (flameSpr) flameSpr.y = stone.y - 28 + Math.sin(g.time * 4) * 4;
      if (Math.hypot(P.x - stone.x, P.y - stone.y) > 2200) { const s = spot(P, 280, 480); stone.x = s.x; stone.y = s.y; stone.spr.x = s.x; stone.spr.y = s.y; }
      if (Math.hypot(P.x - stone.x, P.y - stone.y) < stone.r) {
        state = 'carry'; gutter = cfg.gutter || 75; chan = 0;
        killSpr(g, flameSpr); flameSpr = null;
        const b = spot(stone, 1200, 1800);
        brazier = { x: b.x, y: b.y, r: 72, spr: addSpr(g, 'brazier0', b.x, b.y) };
        g.ui.toast('THE HEARTFLAME IS YOURS: carry it to the brazier', 'fusion');
        sfx.pickup();
      }
      return;
    }
    // carrying: warm enough to shrug off the Rimewood's chill
    P.chillT = 0;
    gutter -= dt;
    if (gutter <= 0) {
      g.ui.toast('THE FLAME GUTTERED: fetch it again', 'warn');
      killSpr(g, brazier && brazier.spr); brazier = null;
      flameSpr = addSpr(g, 'heartflame', stone.x, stone.y - 28, 0.5);
      state = 'stone';
      return;
    }
    const inside = Math.hypot(P.x - brazier.x, P.y - brazier.y) < brazier.r;
    chan = Math.max(0, Math.min(1, chan + (inside ? dt / (cfg.chan || 2) : -dt)));
    o.exempt = ex.tick(inside && chan < 1, dt);
    brazier.spr.texture = tex(chan > 0 && ((g.time * 4) | 0) % 2 ? 'brazier1' : 'brazier0');
    if (chan >= 1) {
      g.dropPickup('chest', brazier.x, brazier.y, 1);
      g.heal(g.stats.maxHp * 0.15, true);
      g.burst(brazier.x, brazier.y, 50, [0xa0e8ff, 0xffa040, 0xffffff], 480, 1);
      g.shockwave(brazier.x, brazier.y, 0xa0e8ff, 400, 0.6);
      clear(); state = 'wait';
      bump(o, g, 'BRAZIER LIT');
    }
  };
  o.onKill = () => {};
  o.spawnMul = () => 1;
  o.slowAt = () => 1;
  o.hud = () => {
    if (o.done) return { title: o.title, count: `${o.n}/${o.n}`, prog: 1, sub: 'Every brazier burns', state: 'done' };
    if (state === 'carry') return { title: o.title, count: `${o.count}/${o.n}`, prog: gutter / (cfg.gutter || 75), sub: `Carry the flame to the brazier before it gutters (${Math.ceil(gutter)}s)`, state: gutter < 20 ? 'warn' : '' };
    if (state === 'stone') return { title: o.title, count: `${o.count}/${o.n}`, prog: 0, sub: 'Touch the Hearthstone to take its flame', state: '' };
    const next = o.count < o.n ? cfg.at[o.count] : 0;
    return { title: o.title, count: `${o.count}/${o.n}`, prog: 0, sub: `The Hearthstone wakes at ${fmt(next)}`, state: '' };
  };
  o.targets = () => (state === 'carry' && brazier ? [brazier] : state === 'stone' && stone ? [stone] : []);
  o.botTargets = () => (state === 'carry' && brazier ? [{ x: brazier.x, y: brazier.y, r: 60, v: 6, camp: true, k: brazier }]
    : state === 'stone' && stone ? [{ x: stone.x, y: stone.y, r: 40, v: 6, camp: false, k: stone }] : []);
  o.draw = (gfx) => {
    if (state === 'carry') {
      const P = g.player;
      gfx.circle(P.x, P.y - 14, 40 + Math.sin(g.time * 8) * 3).fill({ color: 0xffa040, alpha: 0.14 });
      if (brazier) { ring(gfx, brazier.x, brazier.y, brazier.r, 0xa0e8ff, 0.1); arcProg(gfx, brazier.x, brazier.y, brazier.r, chan, 0xffd060); }
    } else if (stone) ring(gfx, stone.x, stone.y, stone.r, 0xffb060, 0.08);
  };
  return o;
}

// ---------- PURGE: drain growing rot pools by standing in them (Drowned Marsh) ----------
function purge(g, cfg) {
  const o = base(g, cfg);
  const ex = makeExempt();
  const pools = [];
  let made = 0, nextT = cfg.at || 120;
  o.update = (dt) => {
    const P = g.player;
    if (made < o.n && pools.length < 2 && g.time >= nextT && !g.boss) {
      const s = spot(P, 900, 1400);
      pools.push({ x: s.x, y: s.y, r: 150, prog: 0, spawnT: 6, spr: addSpr(g, 'rotpool', s.x, s.y, 0.5, 2.4) });
      made++;
      nextT = g.time + 40;
      g.ui.toast('THE MIRE FESTERS: drain the rot pool', 'warn');
      sfx.bossWarn();
    }
    o.exempt = false;
    for (let i = pools.length - 1; i >= 0; i--) {
      const p = pools[i];
      p.r = Math.min(320, p.r + 2 * dt);
      const inside = Math.hypot(P.x - p.x, P.y - p.y) < p.r;
      if (inside) { p.prog = Math.min(1, p.prog + dt / (cfg.chan || 8)); if (p.prog < 1) o.exempt = ex.tick(true, dt); }
      p.spawnT -= dt;
      if (p.spawnT <= 0) {
        p.spawnT = 7;
        if (Math.hypot(P.x - p.x, P.y - p.y) < 1100 && !g.boss) for (let k = 0; k < 2; k++) { const a = Math.random() * TAU, d = Math.random() * p.r * 0.8; g.spawnEnemy('lurker', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { force: true }); }
      }
      if (p.prog >= 1) {
        g.dropPickup('chest', p.x, p.y, 1);
        g.dropPickup('heart', p.x + 30, p.y, 1);
        g.burst(p.x, p.y, 60, [0x80ffb0, 0xffffff, 0x40c090], 480, 1);
        g.shockwave(p.x, p.y, 0x80ffb0, p.r * 1.6, 0.6);
        killSpr(g, p.spr); pools.splice(i, 1);
        bump(o, g, 'POOL DRAINED');
      }
    }
    if (!o.exempt) ex.tick(false, dt);
  };
  o.onKill = (e) => {
    for (const p of pools) if (Math.hypot(e.x - p.x, e.y - p.y) < p.r) p.prog = Math.min(1, p.prog + 0.5 / (cfg.chan || 8));
  };
  o.spawnMul = () => 1;
  o.slowAt = (P) => { for (const p of pools) if (Math.hypot(P.x - p.x, P.y - p.y) < p.r) return 0.85; return 1; };
  o.hud = () => {
    if (o.done) return { title: o.title, count: `${o.n}/${o.n}`, prog: 1, sub: 'The mire runs clear', state: 'done' };
    const P = g.player;
    let near = null, nd = Infinity;
    for (const p of pools) { const d = Math.hypot(p.x - P.x, p.y - P.y); if (d < nd) { nd = d; near = p; } }
    return {
      title: o.title, count: `${o.count}/${o.n}`, prog: near ? near.prog : 0,
      sub: near ? 'Stand in the rot pool to drain it: kills inside help' : made < o.n ? `Another pool festers at ${fmt(Math.max(g.time, nextT))}` : 'Finish the last pools', state: '',
    };
  };
  o.targets = () => pools;
  o.botTargets = () => pools.map((p) => ({ x: p.x, y: p.y, r: p.r * 0.85, v: 5, camp: true, k: p }));
  o.draw = (gfx) => {
    for (const p of pools) { ring(gfx, p.x, p.y, p.r, 0x50d090, 0.1); arcProg(gfx, p.x, p.y, p.r, p.prog, 0xffd060); }
  };
  return o;
}

// ---------- ESCORT: walk the Last Acolyte to a chain of chapels (Shattered Reliquary) ----------
function escort(g, cfg) {
  const o = base(g, cfg);
  let pil = null, chapel = null, targetC = null, downT = 0, legStarted = false, hitT = 0;
  o.update = (dt) => {
    const P = g.player;
    o.exempt = false;
    if (!pil) {
      const s = spot(P, 260, 420);
      chapel = { x: s.x, y: s.y, spr: addSpr(g, 'chapel', s.x, s.y) };
      pil = { x: s.x + 40, y: s.y + 20, hp: 150, max: 150, spr: addSpr(g, 'pilgrim0', s.x + 40, s.y + 20), dir: 1, walkT: 0 };
      return;
    }
    if (!legStarted && o.count < o.n && g.time >= cfg.at[o.count] && !g.boss) {
      const a = Math.random() * TAU;
      targetC = { x: chapel.x + Math.cos(a) * 1600, y: chapel.y + Math.sin(a) * 1600, spr: null };
      targetC.spr = addSpr(g, 'chapel', targetC.x, targetC.y);
      legStarted = true;
      g.ui.toast('THE ACOLYTE SETS OUT: stay close, it only walks with you', 'fusion');
      sfx.shrineSpawn();
    }
    if (downT > 0) {
      downT -= dt;
      pil.spr.alpha = 0.35;
      if (downT <= 0) { pil.hp = pil.max; pil.spr.alpha = 1; g.ui.toast('THE ACOLYTE RELIGHTS', 'pickup'); }
      return;
    }
    const near = Math.hypot(P.x - pil.x, P.y - pil.y) < 260;
    if (legStarted && near) {
      const dx = targetC.x - pil.x, dy = targetC.y - pil.y, d = Math.hypot(dx, dy) || 1;
      pil.x += (dx / d) * 70 * dt; pil.y += (dy / d) * 70 * dt;
      pil.dir = dx < 0 ? -1 : 1; pil.walkT += dt;
      if (d < 45) {
        g.dropPickup('chest', targetC.x, targetC.y, 3);
        g.heal(g.stats.maxHp * 0.2, true);
        g.burst(targetC.x, targetC.y, 60, [0xffd080, 0xc890ff, 0xffffff], 500, 1);
        g.shockwave(targetC.x, targetC.y, 0xffd080, 420, 0.6);
        killSpr(g, chapel.spr); chapel = targetC; targetC = null; legStarted = false;
        bump(o, g, 'CHAPEL REACHED');
      }
    }
    pil.spr.x = pil.x; pil.spr.y = pil.y; pil.spr.scaleX = pil.dir;
    pil.spr.texture = tex(((pil.walkT * 5) | 0) % 2 ? 'pilgrim1' : 'pilgrim0');
    // foes that reach the Acolyte hurt it
    hitT -= dt;
    if (hitT <= 0) {
      hitT = 0.25;
      let dps = 0;
      for (const e of g.enemiesIn(pil.x, pil.y, 70, g.qZone)) if (!e.inert) dps += e.dmg * 0.5;
      pil.hp = dps > 0 ? pil.hp - Math.min(30, dps) * 0.25 : Math.min(pil.max, pil.hp + 3 * 0.25);
      if (pil.hp <= 0) {
        downT = 20; pil.spr.alpha = 0.35;
        g.ui.toast('THE ACOLYTE IS DOWN: it relights in 20s', 'warn');
      }
    }
    if (legStarted) o.exempt = false;
  };
  o.onKill = () => {};
  o.spawnMul = () => 1;
  o.slowAt = () => 1;
  o.hud = () => {
    if (o.done) return { title: o.title, count: `${o.n}/${o.n}`, prog: 1, sub: 'The last candle is lit', state: 'done' };
    if (!pil) return { title: o.title, count: `0/${o.n}`, prog: 0, sub: '', state: '' };
    if (downT > 0) return { title: o.title, count: `${o.count}/${o.n}`, prog: 1 - downT / 20, sub: `The Acolyte is down: it relights in ${Math.ceil(downT)}s`, state: 'warn' };
    if (!legStarted) return { title: o.title, count: `${o.count}/${o.n}`, prog: 0, sub: `The Acolyte sets out at ${fmt(cfg.at[Math.min(o.count, o.n - 1)])}`, state: '' };
    const near = Math.hypot(g.player.x - pil.x, g.player.y - pil.y) < 260;
    return { title: o.title, count: `${o.count}/${o.n}`, prog: pil.hp / pil.max, sub: near ? 'Guard the Acolyte as it walks to the far chapel' : 'Stay within reach: it only walks with you', state: near ? '' : 'warn' };
  };
  o.targets = () => (pil ? [pil] : []);
  o.botTargets = () => (pil && downT <= 0 && legStarted ? [{ x: pil.x, y: pil.y, r: 230, v: 5, camp: true, k: pil }] : []);
  o.draw = (gfx) => {
    if (!pil) return;
    if (legStarted) ring(gfx, pil.x, pil.y, 260, 0xffd080, 0.04, 0.8);
    if (targetC) gfx.circle(targetC.x, targetC.y, 60).fill({ color: 0xffd080, alpha: 0.1 });
  };
  return o;
}

// ---------- MARKED: slay the golden Sun-Bearers and gather their shards (Glass Dunes) ----------
function marked(g, cfg) {
  const o = base(g, cfg);
  const bearers = [];
  let nextT = cfg.first || 90, warned = false;
  o.update = (dt) => {
    nextT -= dt;
    for (let i = bearers.length - 1; i >= 0; i--) if (!bearers[i].alive) bearers.splice(i, 1);
    if (nextT <= 0 && bearers.length < 2 && o.count < o.n && !g.boss) {
      nextT = cfg.every || 60;
      const sp = g.spawnPointOffscreen(80);
      const e = g.spawnEnemy('sunbearer', sp.x, sp.y, { force: true, life: 30 });
      if (e) {
        bearers.push(e);
        if (!warned) { warned = true; g.ui.toast('A SUN-BEARER SCURRIES BY: slay it for a shard', 'pickup'); }
        sfx.thief();
      }
    }
  };
  o.onKill = (e) => {
    if (e.d.sunbearer || (e.boss && !e.d.final)) {
      const pk = g.dropPickup('sunshard', e.x, e.y, 1);
      if (pk) pk.exp = g.time + 20;
      g.ui.toast('A SUN-SHARD FALLS: grab it before it fades', 'pickup');
    }
  };
  o.onShard = () => {
    g.burst(g.player.x, g.player.y, 30, [0xffe080, 0xffffff], 360, 0.9);
    g.shockwave(g.player.x, g.player.y, 0xffe080, 260, 0.4);
    g.heal(g.stats.maxHp * 0.06, false);
    bump(o, g, 'SUN-SHARD');
  };
  o.spawnMul = () => 1;
  o.slowAt = () => 1;
  const shards = () => g.pickups.filter((p) => p.alive && p.type === 'sunshard');
  o.hud = () => {
    if (o.done) return { title: o.title, count: `${o.n}/${o.n}`, prog: 1, sub: 'The sun is whole again', state: 'done' };
    const s = shards();
    let soon = Infinity;
    for (const p of s) soon = Math.min(soon, p.exp - g.time);
    return {
      title: o.title, count: `${o.count}/${o.n}`, prog: Number.isFinite(soon) ? Math.max(0, soon / 20) : 0,
      sub: s.length ? `Walk over the shard before it fades (${Math.ceil(soon)}s)` : bearers.length ? 'Slay the golden Sun-Bearer: it flees' : `Sun-Bearers scurry by every minute: next in ${fmt(Math.max(0, nextT))}`,
      state: s.length && soon < 8 ? 'warn' : '',
    };
  };
  o.targets = () => [...shards(), ...bearers.filter((e) => e.alive)];
  o.botTargets = () => [
    ...shards().map((p) => ({ x: p.x, y: p.y, r: 30, v: 7, camp: false, k: p })),
    ...bearers.filter((e) => e.alive).map((e) => ({ x: e.x, y: e.y, r: 200, v: 3.5, camp: false, k: e })),
  ];
  o.draw = (gfx) => {
    for (const p of shards()) gfx.circle(p.x, p.y, 26).stroke({ color: 0xffe080, width: 3, alpha: 0.4 + 0.3 * Math.sin(g.time * 8) });
  };
  return o;
}

// ---------- DEFEND: hold the lighthouse through three sieges (Stormbreak Coast) ----------
function defend(g, cfg) {
  const o = base(g, cfg);
  const ex = makeExempt();
  const at = cfg.at.slice();
  let lh = null;
  o.update = (dt) => {
    const P = g.player;
    if (!lh && o.count < o.n && g.time >= at[o.count] && !g.boss) {
      const s = spot(P, 380, 520);
      lh = { x: s.x, y: s.y, r: 190, hp: cfg.hp, t: cfg.dur, spr: addSpr(g, 'lighthouse', s.x, s.y, 0.95, 1.5) };
      g.ui.toast('THE STORM BREAKS: hold the lighthouse', 'warn');
      sfx.bossWarn();
      g.runEvent({ type: 'ring', enemy: 'stormkite', count: 14 + Math.floor(g.time / 45) });
    }
    o.exempt = false;
    if (!lh) return;
    const near = g.enemiesIn(lh.x, lh.y, lh.r, g.qZone).filter((e) => e.alive && !e.inert && !e.d.boss);
    const drain = Math.min(9, near.length * 0.8) * (1 + g.time / 1500);
    lh.hp = near.length ? lh.hp - drain * dt : Math.min(cfg.hp, lh.hp + 4 * dt);
    lh.t -= dt;
    o.exempt = ex.tick(Math.hypot(P.x - lh.x, P.y - lh.y) < lh.r + 160, dt);
    lh.spr.tint = lh.hp < cfg.hp * 0.35 ? 0xff9090 : 0xffffff;
    if (lh.hp <= 0) {
      g.ui.toast('THE BEACON FALLS: it relights shortly', 'warn');
      g.shockwave(lh.x, lh.y, 0xff6050, 400, 0.5);
      killSpr(g, lh.spr); lh = null; at[o.count] = g.time + 18;
    } else if (lh.t <= 0) {
      g.dropPickup('chest', lh.x, lh.y, 1);
      g.heal(g.stats.maxHp * 0.2, true);
      g.burst(lh.x, lh.y, 60, [0xffe080, 0xffffff, 0x80c0ff], 520, 1);
      g.shockwave(lh.x, lh.y, 0xffe080, 520, 0.7);
      const sp = lh.spr; setTimeout(() => killSpr(g, sp), 2500);
      lh = null;
      bump(o, g, 'SIEGE HELD');
    }
  };
  o.onKill = () => {};
  o.spawnMul = () => (lh ? 1.25 : 1);
  o.slowAt = () => 1;
  o.hud = () => {
    if (o.done) return { title: o.title, count: `${o.n}/${o.n}`, prog: 1, sub: 'The beacon burns bright', state: 'done' };
    if (!lh) return { title: o.title, count: `${o.count}/${o.n}`, prog: 0, sub: `The next siege breaks at ${fmt(at[o.count])}`, state: '' };
    return {
      title: o.title, count: `${o.count}/${o.n}`, prog: 1 - lh.t / cfg.dur,
      sub: `Beacon ${Math.max(0, Math.ceil((lh.hp / cfg.hp) * 100))}% · hold ${Math.ceil(lh.t)}s · keep foes off the tower`,
      state: lh.hp < cfg.hp * 0.35 ? 'warn' : '',
    };
  };
  o.targets = () => (lh ? [lh] : []);
  o.botTargets = () => (lh ? [{ x: lh.x, y: lh.y, r: lh.r * 0.7, v: 5, camp: true, k: lh }] : []);
  o.draw = (gfx) => {
    if (!lh) return;
    ring(gfx, lh.x, lh.y, lh.r, 0xffe080, 0.05);
    arcProg(gfx, lh.x, lh.y, lh.r - 14, lh.hp / cfg.hp, lh.hp < cfg.hp * 0.35 ? 0xff6050 : 0x80e0ff);
  };
  return o;
}

const TYPES = { kindle, march: kindle, nests, carry, purge, escort, marked, defend };

export function makeObjective(g) {
  const cfg = g.stage.objective;
  if (!cfg || !TYPES[cfg.type]) {
    return {
      cfg: null, n: 0, count: 0, done: true, doneAt: 0, exempt: false, title: '',
      update() {}, onKill() {}, spawnMul: () => 1, slowAt: () => 1, hud: () => null, targets: () => [], botTargets: () => [], draw() {}, onShard() {},
    };
  }
  return TYPES[cfg.type](g, cfg);
}
