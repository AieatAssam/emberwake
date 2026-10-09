// Dev-only headless balance simulator. Loaded only in `vite dev` (see main.js).
//
//   await __sim(secs, charId, { skill, difficulty, stage, heat, meta, seed, stand, dt })
//
// Runs the real Game.update loop with a bot that drives the player ONLY through setBotInput(),
// so speed buffs, soft obstacles and slows all apply. "Skill" is a dial of human-like competence
// (reaction interval, awareness, lookahead, dodging, drafting, flare timing), never of stats.
import { setBotInput } from './input.js';
import { TUNE } from './tuning.js';
import { save } from './save.js';
import { DIFFICULTY, META, STAGES, fusionPartnersOf } from './data.js';

// ---------- skill table ----------
// decide: seconds between decisions (0 = every frame); dirs: candidate headings; look: lookahead (s);
// aware: perception radius (px); shotW/shotR: projectile dodge weight/range; telW: telegraph weight;
// margin: extra personal space around enemies (px); kite: [lo, hi] preferred boss range (null = none);
// pickW: pull toward pickups; crowdAvoid: pickups in crowds are discounted; bad: chance a decision is
// random/idle; noise: steering error (rad); obsW/slowW: soft-obstacle / slow-zone avoidance.
const SKILLS = {
  novice: {
    decide: 0.45, dirsMin: 4, dirsMax: 6, look: 0.2, samples: 2, aware: 110, bossAware: 260,
    shotW: 0, shotR: 0, telW: 0, margin: 6, kite: null, pickW: 1.5, pickRange: 380, crowdAvoid: 0,
    bad: 0.08, noise: 0.45, obsW: 0.25, slowW: 0, hold: 0.1, stuckT: 1.2, knowsFreeze: false,
    chestW: 1.5, shrine: 0, flare: 'novice', draft: 'novice', dashAware: false,
  },
  average: {
    decide: 0.2, dirsMin: 8, dirsMax: 8, look: 0.35, samples: 3, aware: 170, bossAware: 420,
    shotW: 0.35, shotR: 160, telW: 0.3, margin: 20, kite: null, pickW: 1.0, pickRange: 520, crowdAvoid: 0.25,
    bad: 0.03, noise: 0.2, obsW: 0.6, slowW: 0.1, hold: 0.25, stuckT: 0.8, knowsFreeze: true,
    chestW: 3.5, shrine: 0.3, flare: 'average', draft: 'average', dashAware: false,
  },
  skilled: {
    decide: 0.12, dirsMin: 16, dirsMax: 16, look: 0.45, samples: 4, aware: 215, bossAware: 560,
    shotW: 0.9, shotR: 280, telW: 1.0, margin: 30, kite: [250, 380], pickW: 0.8, pickRange: 700, crowdAvoid: 0.7,
    bad: 0.004, noise: 0.07, obsW: 1.2, slowW: 0.5, hold: 0.35, stuckT: 0.4, knowsFreeze: true,
    chestW: 6, shrine: 0.8, flare: 'skilled', draft: 'skilled', dashAware: true,
  },
  expert: {
    decide: 0, dirsMin: 24, dirsMax: 24, look: 0.7, samples: 5, aware: 300, bossAware: 700,
    shotW: 1.4, shotR: 380, telW: 1.5, margin: 44, kite: [210, 340], pickW: 0.8, pickRange: 900, crowdAvoid: 1.0,
    bad: 0, noise: 0.02, obsW: 1.8, slowW: 1.2, hold: 0.4, stuckT: 0.25, knowsFreeze: true,
    chestW: 8, shrine: 1, flare: 'expert', draft: 'expert', dashAware: true,
  },
};

// ---------- seeded PRNG ----------
function mulberry32(a) {
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- drafting ----------
const PASSIVE_VALUE = {
  might: 8, haste: 7, reach: 6, multicast: 7.5, vitality: 5.5, regen: 5, armor: 5, swift: 4.5, growth: 4.2,
  crit: 3.8, magnet: 3.2, velocity: 3, duration: 3, reservoir: 3.2, thorns: 2.8, luck: 2.6, greed: 1,
};
const DEFENSIVE = new Set(['vitality', 'regen', 'armor']);
const PACT_VALUE = { wick: 5.2, hunger: 4, frenzy: 3.2, avarice: 1.6, glass: 2, ashes: 1.4 };

function scoreChoice(g, c, bot) {
  const sk = bot.sk, hpF = g.player.hp / g.stats.maxHp, nW = g.weapons.length;
  const expert = bot.name === 'expert';
  if (c.kind === 'weapon') {
    let v;
    if (c.isNew) v = nW < 3 ? 7.5 : nW < 5 ? 5.8 : 4.2;
    else v = 6.4 - 0.12 * c.level;
    let pairHit = false;
    for (const fp of fusionPartnersOf(c.id)) {
      const mine = g.weapons.find((w) => w.id === fp.partner && !w.fused);
      if (mine) { v += c.isNew ? 3.8 : 1.6; pairHit = true; }
      else if (c.isNew && nW < 5) v += 1.0;
    }
    if (expert && c.isNew && nW >= 4 && !pairHit) v -= 1.6;
    return v;
  }
  if (c.kind === 'passive') {
    let v = PASSIVE_VALUE[c.id] ?? 3;
    if (!c.isNew) v *= 1 - 0.06 * (c.level - 1);
    if (DEFENSIVE.has(c.id)) v *= 1 + (expert ? 0.9 : 0.5) * (1 - hpF);
    if (c.id === 'growth' && g.time > 360) v *= 0.5;
    if (c.id === 'magnet' && g.time > 420) v *= 0.6;
    return v;
  }
  if (c.kind === 'pact') return (PACT_VALUE[c.id] ?? 2) - g.pacts.length * 1.2 - (sk.draft === 'expert' && hpF < 0.5 ? 1 : 0);
  if (c.kind === 'overcharge') return 3.2;
  if (c.kind === 'heal') return 1.5 + 4 * (1 - hpF);
  return 0.8; // cinderBag
}

function draftNovice(g, choices) {
  const w = choices.map((c) => (c.kind === 'weapon' && c.isNew ? 3 : 1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
  for (; i < w.length - 1; i++) { r -= w[i]; if (r <= 0) break; }
  g.applyChoice(choices[i]);
}

function draftAverage(g, choices) {
  const ok = choices.filter((c) => c.kind !== 'pact');
  const pool = ok.length ? ok : choices;
  const weapons = pool.filter((c) => c.kind === 'weapon');
  const passives = pool.filter((c) => c.kind === 'passive');
  let pick = null;
  if (weapons.length && (Math.random() < 0.6 || !passives.length)) {
    pick = weapons.find((c) => c.isNew && g.weapons.length < 4) || weapons[(Math.random() * weapons.length) | 0];
  } else if (passives.length) {
    const good = ['might', 'haste', 'reach', 'vitality', 'multicast', 'regen', 'armor'];
    pick = passives.find((c) => good.includes(c.id)) || passives[0];
  }
  g.applyChoice(pick || pool[0]);
}

// skilled / expert: score everything, reroll/banish/skip with intent
function draftSmart(g, choices, bot) {
  const expert = bot.name === 'expert';
  const rerollBelow = expert ? 5.6 : 4.6, banishBelow = expert ? 3.2 : 2.5, skipBelow = expert ? 2.0 : 1.4;
  let list = choices, guard = 0;
  while (guard++ < 12) {
    const scored = list.map((c) => ({ c, s: scoreChoice(g, c, bot) })).sort((a, b) => b.s - a.s);
    const best = scored[0];
    if (best.s < rerollBelow && g.rerolls > 0) { g.rerolls--; list = g.buildChoices(); continue; }
    if (g.banishes > 0) {
      const junk = scored.find((x) => (x.c.kind === 'weapon' || x.c.kind === 'passive') && x.s < banishBelow);
      if (junk && scored.length > 1) {
        g.banished.add(junk.c.id); g.banishes--;
        list = list.filter((c) => c !== junk.c);
        if (!list.length) list = g.buildChoices();
        continue;
      }
    }
    if (best.s < skipBelow) { g.gainXp(g.xpNext * 0.25); return; }
    g.applyChoice(best.c);
    return;
  }
  g.applyChoice(list[0]);
}

function draft(g, choices, bot) {
  if (bot.sk.draft === 'novice') draftNovice(g, choices);
  else if (bot.sk.draft === 'average') draftAverage(g, choices);
  else draftSmart(g, choices, bot);
}

// ---------- flare ----------
const OFFENSIVE_FLARES = new Set(['overclock', 'bloodrage', 'deadeye', 'hearthfire']);
function wantFlare(g, bot, ctx) {
  if (g.flare < 100) { bot.flareReady = 0; return false; }
  bot.flareReady += ctx.dt;
  const hpF = g.player.hp / g.stats.maxHp;
  const kind = g.char.flare, boss = g.boss && g.boss.alive ? g.boss : null;
  const bossNear = boss && Math.hypot(boss.x - g.player.x, boss.y - g.player.y) < 520;
  switch (bot.sk.flare) {
    case 'novice':
      return Math.random() < ctx.dt * 0.05 || (hpF < 0.3 && Math.random() < ctx.dt * 2);
    case 'average':
      return ctx.near220 >= 12 || bossNear;
    case 'skilled': {
      if (OFFENSIVE_FLARES.has(kind)) return bossNear || ctx.near260 >= 24 || (bot.flareReady > 45 && ctx.near260 >= 10);
      return bossNear || ctx.near260 >= 26 || (hpF < 0.5 && ctx.near220 >= 8) || (bot.flareReady > 45 && ctx.near260 >= 10);
    }
    default: { // expert
      if (OFFENSIVE_FLARES.has(kind)) return bossNear || ctx.near260 >= 22 || (bot.flareReady > 35 && ctx.near260 >= 10);
      return bossNear || ctx.near260 >= 24 || (hpF < 0.55 && ctx.near220 >= 7) || ctx.pinned || (bot.flareReady > 35 && ctx.near260 >= 10);
    }
  }
}

// ---------- perception & movement ----------
// Gather what the bot "sees" this decision: threats (with simple motion models), shots, zones, obstacles.
function observe(g, bot) {
  const sk = bot.sk, P = g.player;
  const ES = Math.min(1.5, g.stats.enemySpeed * (g.buffs.bloodMoon > 0 ? 1.3 : 1));
  const en = [];
  let near220 = 0, near260 = 0;
  const aw2 = sk.aware * sk.aware;
  for (const e of g.enemies) {
    if (!e.alive || e.inert) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d2 = dx * dx + dy * dy;
    if (d2 < 220 * 220) near220++;
    if (d2 < 260 * 260) near260++;
    const hollow = e.d.hollow;
    let range = e.boss ? sk.bossAware : e.elite ? sk.aware * 1.3 : sk.aware;
    if (hollow) range = Math.max(range, 520);
    if (d2 > range * range && !(e.boss && g.boss === e)) { if (!e.rush || d2 > (range + 200) * (range + 200)) continue; }
    if (!hollow && !e.boss && d2 > aw2 * (e.elite ? 1.7 : 1) && !e.rush) continue;
    if (e.dmg <= 0 && !e.boss) continue;
    let w = hollow ? 30 : clamp(e.dmg / 10, 0.3, 4);
    if (e.freezeT > 0 && sk.knowsFreeze) w *= 0.05;
    let margin = sk.margin * (e.boss ? 3 : e.elite ? 1.7 : 1) + (hollow ? 140 : 0);
    const sp = hollow ? Math.min(200, e.speed + e.t * 0.5) : e.speed * ES * (e.slowT > 0 ? 0.5 : 1) * (e.freezeT > 0 ? 0 : 1);
    const o = { x: e.x, y: e.y, R: e.r + P.r, w, margin, sp, vx: 0, vy: 0, t0: 0, homing: true };
    if (e.rush) { o.homing = false; o.vx = e.rush.x * sp * 2.4; o.vy = e.rush.y * sp * 2.4; }
    else if (e.d.charge && e.state >= 1 && sk.dashAware) {
      o.homing = false; o.vx = e.dirX * sp * 5; o.vy = e.dirY * sp * 5;
      o.t0 = e.state === 1 ? e.stT : 0; margin += 20; o.margin = margin;
    }
    if (e.d.flee) { o.homing = false; o.w = 0.1; }
    en.push(o);
  }
  // enemy projectiles
  const shots = [];
  if (sk.shotW > 0) {
    const r2 = sk.shotR * sk.shotR;
    for (const b of g.enemyShots) {
      const dx = b.x - P.x, dy = b.y - 12 - P.y;
      if (dx * dx + dy * dy < r2) shots.push(b);
    }
  }
  // telegraphed ground hazards (incl. boss slam wind-ups)
  const zones = [];
  if (sk.telW > 0) {
    for (const z of g.zones) if (z.type === 'telegraph') zones.push(z);
    for (const e of g.enemies) if (e.boss && e.alive && e.charging > 0 && e.d.slam) zones.push({ x: e.x, y: e.y, r: 240, t: e.stT });
  }
  const springs = [];
  for (const z of g.zones) if (z.type === 'spring') springs.push(z);
  // soft obstacles near the player
  const obs = [];
  const C = 480, cx = Math.floor(P.x / C), cy = Math.floor(P.y / C);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const list = g.obstacles.get((cx + a) + ',' + (cy + b));
    if (list) for (const ob of list) {
      if (Math.abs(ob.x - P.x) < 320 && Math.abs(ob.y - P.y) < 320) obs.push(ob);
    }
  }
  return { en, shots, zones, springs, obs, near220, near260, ES };
}

// Pick the pickup (or shrine/spring) to head for.
function chooseTarget(g, bot, ob) {
  const sk = bot.sk, P = g.player, hpF = P.hp / g.stats.maxHp;
  const cand = [];
  const range2 = sk.pickRange * sk.pickRange;
  const gemsAround = g.gemCount || 0;
  for (const k of g.pickups) {
    if (!k.alive || (k.attract && k.type !== 'chest')) continue;
    const dx = k.x - P.x, dy = k.y - P.y, d2 = dx * dx + dy * dy;
    if (d2 > range2) continue;
    let v;
    switch (k.type) {
      case 'gem': v = clamp(0.5 + Math.sqrt(k.value) * 0.35, 0.5, 3.5); break;
      case 'cinder': v = 0.45; break;
      case 'heart': v = g.stats.noHeal ? 0 : hpF < 0.75 ? 4 * (1 - hpF) + 0.5 : 0.1; break;
      case 'chest': v = sk.chestW; break;
      case 'magnet': v = gemsAround > 25 ? 2 : 0.6; break;
      case 'flareorb': v = g.flare < 100 ? 2 : 0.3; break;
      case 'bomb': case 'freeze': v = 1.2; break;
      default: v = 0.5;
    }
    if (v <= 0) continue;
    const d = Math.sqrt(d2);
    cand.push({ k, v, d, s: v / (d + 80), x: k.x, y: k.y });
  }
  // shrine: hold position inside its ring for a relic chest (only when the coast is clear)
  const sh = g.shrine;
  if (sh && bot.shrineRoll < sk.shrine && !g.boss) {
    const d = Math.hypot(sh.x - P.x, sh.y - P.y);
    if (d < 1000) cand.push({ k: sh, shrine: true, v: 5, d, s: 5 / (d + 80), x: sh.x, y: sh.y });
  }
  if (hpF < 0.65 && sk.pickW > 0.5 && !g.stats.noHeal) {
    for (const z of ob.springs) {
      const d = Math.hypot(z.x - P.x, z.y - P.y);
      if (d < 700 && z.t > d / 150 + 1) cand.push({ k: z, spring: true, v: 4 * (1 - hpF) + 1, d, s: (4 * (1 - hpF) + 1) / (d + 80), x: z.x, y: z.y });
    }
  }
  if (!cand.length) return null;
  cand.sort((a, b) => b.s - a.s);
  if (sk.crowdAvoid <= 0) return cand[0];
  let best = null, bs = -1;
  const top = Math.min(cand.length, 7);
  for (let i = 0; i < top; i++) {
    const c = cand[i];
    let crowd = 0;
    for (const e of ob.en) {
      const dx = e.x - c.x, dy = e.y - c.y;
      if (dx * dx + dy * dy < 140 * 140) crowd += e.w;
    }
    const s = c.s / (1 + sk.crowdAvoid * crowd * 0.5);
    if (c.k === bot.target) { /* stickiness */ if (s * 1.25 > bs) { best = c; bs = s * 1.25; } continue; }
    if (s > bs) { best = c; bs = s; }
  }
  return best;
}

function decide(g, bot, ctxIn) {
  const sk = bot.sk, P = g.player, S = g.stats;
  const ob = observe(g, bot);
  ctxIn.near220 = ob.near220; ctxIn.near260 = ob.near260;
  const spd = S.moveSpeed * (g.buffs.bloodrage > 0 ? 1.3 : 1) * (P.chillT > 0 ? 0.75 : 1);

  // random lapses (novice-heavy): idle or wander off in a random direction
  if (Math.random() < sk.bad) {
    if (Math.random() < 0.4) return { x: 0, y: 0 };
    const a = Math.random() * 6.2832;
    return { x: Math.cos(a), y: Math.sin(a) };
  }
  // anti-stuck: break out in a random direction
  if (bot.stuckT > sk.stuckT) {
    bot.stuckT = 0; bot.escapeT = 0.5; bot.escapeA = Math.random() * 6.2832;
  }
  if (bot.escapeT > 0) return { x: Math.cos(bot.escapeA), y: Math.sin(bot.escapeA) };

  // target selection
  const tgt = chooseTarget(g, bot, ob);
  bot.target = tgt ? tgt.k : null;
  let tx, ty, tv, camp = null;
  if (tgt) {
    tx = tgt.x; ty = tgt.y; tv = Math.min(2.5, tgt.v);
    if (tgt.shrine) {
      const d = Math.hypot(tx - P.x, ty - P.y);
      if (d < g.shrine.r * 0.7) camp = tgt; // inside: orbit in place until it kindles
    }
  } else {
    // wander on a slow figure-eight so we keep moving through open ground
    bot.wanderA += bot.wanderDir * 0.5 * Math.max(sk.decide, 1 / 30);
    bot.wanderT -= Math.max(sk.decide, 1 / 30);
    if (bot.wanderT <= 0) { bot.wanderDir *= -1; bot.wanderT = 5 + Math.random() * 5; }
    tx = P.x + Math.cos(bot.wanderA) * 400; ty = P.y + Math.sin(bot.wanderA) * 400; tv = 0.35;
  }

  // candidate headings
  const cands = [];
  const n = sk.dirsMin + Math.floor(Math.random() * (sk.dirsMax - sk.dirsMin + 1));
  const off = Math.random() * 6.2832;
  for (let i = 0; i < n; i++) { const a = off + (i / n) * 6.2832; cands.push(Math.cos(a), Math.sin(a)); }
  const tl = Math.hypot(tx - P.x, ty - P.y) || 1;
  if (sk.dirsMin >= 8) {
    cands.push((tx - P.x) / tl, (ty - P.y) / tl);
    if (bot.prev) cands.push(bot.prev.x, bot.prev.y);
    // directly away from the nearby crowd
    let ax = 0, ay = 0;
    for (const e of ob.en) { const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1; const wt = e.w / (d * d + 2500); ax += dx / d * wt; ay += dy / d * wt; }
    const al = Math.hypot(ax, ay);
    if (al > 0) cands.push(ax / al, ay / al);
  }

  const look = sk.look, ns = sk.samples;
  const boss = g.boss && g.boss.alive ? g.boss : null;
  let bestC = Infinity, bx = 0, by = 0;
  for (let ci = 0; ci < cands.length; ci += 2) {
    const ux = cands[ci], uy = cands[ci + 1];
    let cost = 0;
    // enemies (predicted)
    for (let k = 1; k <= ns; k++) {
      const t = (look * k) / ns, px = P.x + ux * spd * t, py = P.y + uy * spd * t;
      for (let i = 0; i < ob.en.length; i++) {
        const e = ob.en[i];
        let gap;
        if (e.homing) gap = Math.max(0, Math.hypot(e.x - px, e.y - py) - e.sp * t) - e.R;
        else { const tt = Math.max(0, t - e.t0); gap = Math.hypot(e.x + e.vx * tt - px, e.y + e.vy * tt - py) - e.R; }
        if (gap < e.margin) {
          const f = gap <= 0 ? 1 + Math.min(1, -gap / e.R) * 0.5 : (1 - gap / e.margin) ** 2;
          cost += (e.w * f) / ns * (1 + 0.4 * (k / ns));
        }
      }
      // telegraphs
      for (let i = 0; i < ob.zones.length; i++) {
        const z = ob.zones[i];
        if (Math.hypot(z.x - px, z.y - py) < z.r + 12) cost += sk.telW * (z.t <= t + 0.12 ? 1.6 : 0.35) / ns * 2;
      }
      // soft obstacles, slow zones, vents
      for (let i = 0; i < ob.obs.length; i++) {
        const o = ob.obs[i];
        const d = Math.hypot(o.x - px, o.y - py);
        if (o.haz) { if (d < o.haz.r + 16) cost += sk.telW * 0.25 / ns; }
        else if (o.slow) { if (d < o.r + 10) cost += sk.slowW * (1 - o.slow) * 1.2 / ns; }
        else if (d < o.r + 18) cost += sk.obsW * 0.45 / ns;
      }
    }
    // projectiles via closest approach
    for (let i = 0; i < ob.shots.length; i++) {
      const b = ob.shots[i];
      const rx = b.x - P.x, ry = b.y - 12 - P.y, vx = b.vx - ux * spd, vy = b.vy - uy * spd;
      const vv = vx * vx + vy * vy;
      const tc = vv > 1 ? clamp(-(rx * vx + ry * vy) / vv, 0, Math.min(look * 1.3, b.life)) : 0;
      const d = Math.hypot(rx + vx * tc, ry + vy * tc);
      const m = 18 + 10 + sk.margin * 0.5;
      if (d < m) cost += sk.shotW * clamp(b.dmg / 12, 0.3, 3) * (1 - d / m) ** 1.5 * (1.4 - tc / (look * 1.3 + 0.01));
    }
    // endpoint terms
    const ex = P.x + ux * spd * look, ey = P.y + uy * spd * look;
    if (boss && sk.kite) {
      const db = Math.hypot(boss.x - ex, boss.y - ey);
      const lo = sk.kite[0], hi = sk.kite[1];
      if (db < lo) cost += 1.2 * (lo - db) / lo;
      else if (db > hi && !tgt) cost += 0.4 * Math.min(1, (db - hi) / hi);
    }
    if (camp) {
      const dc = Math.hypot(camp.x - ex, camp.y - ey);
      if (dc > g.shrine.r * 0.8) cost += 0.8;
    } else {
      // pull toward the target (progress over the horizon)
      const d0 = tl, d1 = Math.hypot(tx - ex, ty - ey);
      cost -= sk.pickW * tv * clamp((d0 - d1) / (spd * look), -1, 1);
    }
    if (bot.prev) cost -= sk.hold * Math.max(0, ux * bot.prev.x + uy * bot.prev.y);
    if (cost < bestC) { bestC = cost; bx = ux; by = uy; }
  }
  ctxIn.pinned = bestC > 2.5;
  // human steering error
  if (sk.noise > 0) {
    const a = Math.atan2(by, bx) + (Math.random() + Math.random() + Math.random() - 1.5) * 2 * sk.noise;
    bx = Math.cos(a); by = Math.sin(a);
  }
  return { x: bx, y: by };
}

// ---------- the sim ----------
export function install(startRun, getGame) {
  window.__sim = async (secs = 600, charId = 'warden', opts = {}) => {
    const skillName = SKILLS[opts.skill] ? opts.skill : 'average';
    const sk = SKILLS[skillName];
    const dt = opts.dt || 1 / 30;
    const t0 = performance.now();
    // in-memory save tweaks (never persisted by us)
    const savedMeta = { ...save.meta }, savedDiff = save.settings.difficulty, savedLowfx = save.settings.lowfx, savedNumbers = save.settings.numbers;
    save.settings.lowfx = true;
    save.settings.numbers = false; // nobody is watching: no damage numbers
    const savedSel = { ...save.heatSel }, savedMax = { ...save.heatMax };
    const origRandom = Math.random;
    const tuneBefore = { ...TUNE };
    if (opts.tune) Object.assign(TUNE, opts.tune);
    const diff = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
    const stageId = STAGES[opts.stage] ? opts.stage : 'gloam';
    const heat = Math.max(0, Math.min(10, opts.heat | 0));
    const metaFrac = Math.max(0, Math.min(1, opts.meta || 0));
    save.settings.difficulty = diff;
    save.heatSel[stageId] = heat; save.heatMax[stageId] = heat;
    save.meta = {};
    for (const id in META) { const l = Math.round(metaFrac * META[id].max); if (l) save.meta[id] = l; }
    if (typeof opts.seed === 'number') Math.random = mulberry32(opts.seed >>> 0);

    const bot = {
      name: skillName, sk, flareReady: 0, prev: null, target: null, stuckT: 0, escapeT: 0, escapeA: 0,
      wanderA: Math.random() * 6.2832, wanderDir: 1, wanderT: 6, shrineRoll: Math.random(),
    };
    let minHp = 1, stuckMs = 0, steps = 0, nextMark = 60;
    const series = [];
    try {
      startRun(charId, stageId);
      const g = getGame();
      const ui = g.ui;
      ui.close();
      // the page's own ticker must not advance or draw this game while we drive it
      const realUpdate = g.update.bind(g);
      let gate = false;
      g.update = (d) => { if (gate) realUpdate(d); };
      if (!opts.render) { g.render = () => {}; g.flash = () => {}; g.maxFx = g.baseFx = 0; } // no particles either: spawnFx bails at once
      ui.showLevelUp = (gg, pre) => draft(gg, pre || gg.buildChoices(), bot);
      ui.showChest = (gg, res) => gg.applyChest(res);
      ui.showResults = () => {}; ui.showVictory = () => {};
      ui.toast = () => {}; ui.hintPop = () => {}; ui.featPop = () => {}; ui.kindlePop = () => {};
      ui.updateHUD = () => {};

      const P = g.player;
      const ctx = { dt, near220: 0, near260: 0, pinned: false };
      let nextDecision = 0, simT = 0;
      const maxSteps = Math.ceil((secs / dt) * 4) + 100;
      let cur = { x: 0, y: 0 };
      while (!g.dead && !g.victory && g.time < secs && steps < maxSteps) {
        steps++; simT += dt;
        if (opts.stand) { cur = { x: 0, y: 0 }; }
        else {
          if (simT >= nextDecision) {
            cur = decide(g, bot, ctx);
            bot.prev = cur;
            nextDecision = simT + sk.decide;
          }
          if (bot.escapeT > 0) bot.escapeT -= dt;
        }
        setBotInput(cur);
        if (wantFlare(g, bot, ctx)) { g.triggerFlare(); bot.flareReady = 0; }
        const px = P.x, py = P.y;
        gate = true; g.update(dt); gate = false;
        // stuck detection: commanded movement that produced almost no displacement
        if (!opts.stand && (cur.x || cur.y)) {
          const moved = Math.hypot(P.x - px, P.y - py), want = g.stats.moveSpeed * dt * Math.hypot(cur.x, cur.y);
          if (moved < want * 0.3 && P.iframes <= 0) { bot.stuckT += dt; stuckMs += dt * 1000; } else bot.stuckT = Math.max(0, bot.stuckT - dt);
        }
        minHp = Math.min(minHp, P.hp / g.stats.maxHp);
        if (g.time >= nextMark) { series.push({ t: nextMark, lvl: g.level, kills: g.kills, hp: Math.round((100 * P.hp) / g.stats.maxHp), alive: g.enemies.length, cin: g.cinders }); nextMark += 60; }
        if (steps % 300 === 0) await new Promise((r) => { setTimeout(r, 0); });
      }
      setBotInput(null);
      const win = !!g.victory && !g.dead;
      const reward = g.runReward(win);
      return {
        skill: skillName, char: charId, stage: stageId, difficulty: diff, heat, metaFrac, seed: opts.seed ?? null,
        win, dead: !!g.dead, timedOut: !win && !g.dead, time: Math.round(g.time * 10) / 10, level: g.level, kills: g.kills,
        cinders: reward.total, gathered: reward.gathered, bestCombo: g.bestCombo, overcharge: g.overcharge || 0,
        killedBy: g.dead ? g.lastHitBy || '?' : null, hpMinPct: Math.max(0, Math.round(minHp * 100)),
        weapons: g.weapons.map((w) => `${w.id}:${w.level}`), fusions: g.weapons.filter((w) => w.fused).map((w) => w.id),
        passives: { ...g.passives }, pacts: [...g.pacts], series, chests: g.chestsOpened || 0, chestItems: g.chestItems || 0,
        wallMs: Math.round(performance.now() - t0), stuckMs: Math.round(stuckMs),
      };
    } finally {
      setBotInput(null);
      Math.random = origRandom;
      Object.assign(TUNE, tuneBefore);
      save.meta = savedMeta; save.settings.difficulty = savedDiff; save.settings.lowfx = savedLowfx; save.settings.numbers = savedNumbers; save.heatSel = savedSel; save.heatMax = savedMax;
    }
  };
}
