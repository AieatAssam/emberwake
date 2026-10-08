// Emberwake core simulation + rendering.
import { Container, ParticleContainer, Particle, Sprite, TilingSprite, Texture, Graphics, Rectangle } from 'pixi.js';
import { T, makeGroundCanvas, makeVignetteCanvas } from './atlas.js';
import {
  BASE_STATS, WEAPONS, PASSIVES, PACTS, CHARACTERS, ENEMIES, WAVES, EVENTS, META, FUSIONS,
  MAX_WEAPON_LEVEL, MAX_WEAPONS, MAX_PASSIVES, xpForLevel, enemyHpScale, weaponStatsAt, fusionPartnerOf,
} from './data.js';
import { BEHAVIORS } from './weapons.js';
import { sfx, setIntensity } from './audio.js';
import { moveVector, consumePressed, padButtons } from './input.js';
import { save, persist } from './save.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
export const KINDLE_TIERS = [
  { at: 0, mul: 1 }, { at: 25, mul: 1.15 }, { at: 70, mul: 1.3 }, { at: 150, mul: 1.5 },
  { at: 300, mul: 1.75 }, { at: 600, mul: 2 }, { at: 1200, mul: 2.5 },
];
const MAX_ENEMIES = 1100;
const MAX_FX = 3500;
const GEM_CAP = 650;

// ---------- particle layer with in-place compaction ----------
class Layer {
  constructor(parent, blend = 'normal') {
    this.pc = new ParticleContainer({
      dynamicProperties: { vertex: true, position: true, rotation: true, uvs: true, color: true },
      texture: T.glow,
    });
    this.pc.blendMode = blend;
    this.pc.boundsArea = new Rectangle(-1e7, -1e7, 2e7, 2e7);
    parent.addChild(this.pc);
    this.list = this.pc.particleChildren;
    this.pool = [];
    this.dirty = false;
  }
  add(tex, x, y) {
    let p = this.pool.pop();
    if (!p) p = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5 });
    p.texture = tex; p.x = x; p.y = y; p.scaleX = 1; p.scaleY = 1; p.rotation = 0;
    p.anchorX = 0.5; p.anchorY = 0.5; p.tint = 0xffffff; p.alpha = 1; p._dead = false;
    this.list.push(p);
    this.dirty = true;
    return p;
  }
  kill(p) { if (p && !p._dead) { p._dead = true; this.dirty = true; } }
  flush() {
    if (!this.dirty) return;
    const l = this.list;
    let j = 0;
    for (let i = 0; i < l.length; i++) {
      const p = l[i];
      if (p._dead) this.pool.push(p); else l[j++] = p;
    }
    l.length = j;
    this.pc.update();
    this.dirty = false;
  }
}

// ---------- spatial hash ----------
class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); this.pool = []; this.stamp = 0; }
  clear() {
    for (const a of this.map.values()) { a.length = 0; this.pool.push(a); }
    this.map.clear();
  }
  insert(e) {
    const c = this.cell;
    if (e.r > c * 0.5) {
      const x0 = Math.floor((e.x - e.r) / c), x1 = Math.floor((e.x + e.r) / c);
      const y0 = Math.floor((e.y - e.r) / c), y1 = Math.floor((e.y + e.r) / c);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) this._put(cx, cy, e);
    } else this._put(Math.floor(e.x / c), Math.floor(e.y / c), e);
  }
  _put(cx, cy, e) {
    const k = (cx + 32768) * 65536 + (cy + 32768);
    let a = this.map.get(k);
    if (!a) { a = this.pool.pop() || []; this.map.set(k, a); }
    a.push(e);
  }
  // pushes enemies whose circle intersects (x,y,r) into out
  query(x, y, r, out) {
    const c = this.cell, st = ++this.stamp;
    const x0 = Math.floor((x - r - 24) / c), x1 = Math.floor((x + r + 24) / c);
    const y0 = Math.floor((y - r - 24) / c), y1 = Math.floor((y + r + 24) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = this.map.get((cx + 32768) * 65536 + (cy + 32768));
      if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const e = a[i];
        if (e._q === st || !e.alive) continue;
        e._q = st;
        const dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy <= rr * rr) out.push(e);
      }
    }
    return out;
  }
  cellAt(x, y) { return this.map.get((Math.floor(x / this.cell) + 32768) * 65536 + (Math.floor(y / this.cell) + 32768)); }
}

let uidCounter = 1;

export class Game {
  constructor(app, ui, charId) {
    this.app = app;
    this.ui = ui;
    this.charId = charId;
    this.char = CHARACTERS[charId];

    this.root = new Container();
    app.stage.addChild(this.root);

    const groundTex = Texture.from(makeGroundCanvas());
    groundTex.source.addressMode = 'repeat';
    this.ground = new TilingSprite({ texture: groundTex, width: app.screen.width, height: app.screen.height });
    this.ground.tint = 0xb8b8d0;
    this.root.addChild(this.ground);

    this.world = new Container();
    this.root.addChild(this.world);
    this.L = {
      decor: new Layer(this.world),
      glowUnder: new Layer(this.world, 'add'),
      pickups: new Layer(this.world),
      enemies: new Layer(this.world),
    };
    this.playerGlow = new Sprite(T.softglow);
    this.playerGlow.anchor.set(0.5);
    this.playerGlow.blendMode = 'add';
    this.world.addChild(this.playerGlow);
    this.playerSprite = new Sprite(T[this.char.sprite]);
    this.playerSprite.anchor.set(0.5, 0.88);
    this.world.addChild(this.playerSprite);
    this.hpBar = new Graphics();
    this.world.addChild(this.hpBar);
    this.L.proj = new Layer(this.world);
    this.L.projAdd = new Layer(this.world, 'add');
    this.L.fx = new Layer(this.world);
    this.L.fxAdd = new Layer(this.world, 'add');
    this.L.nums = new Layer(this.world);

    this.vignette = new Sprite(Texture.from(makeVignetteCanvas()));
    this.root.addChild(this.vignette);
    this.hurtVignette = new Sprite(this.vignette.texture);
    this.hurtVignette.tint = 0xff0020; this.hurtVignette.alpha = 0; this.hurtVignette.blendMode = 'add';
    this.root.addChild(this.hurtVignette);
    this.indicators = new Graphics();
    this.root.addChild(this.indicators);
    this.flashG = new Graphics();
    this.root.addChild(this.flashG);
    this.flashAlpha = 0; this.flashColor = 0xffffff;

    this.grid = new Grid(64);
    this.qa = []; this.qb = []; this.qExp = []; this.qNova = [];
    this.fxPool = []; this.projPool = []; this.numPool = [];

    // state
    this.time = 0; this.kills = 0; this.level = 1; this.xp = 0; this.xpNext = xpForLevel(1);
    this.cinders = 0; this.pendingLevels = 0;
    this.enemies = []; this.projectiles = []; this.enemyShots = []; this.fx = []; this.pickups = []; this.numbers = [];
    this.weapons = []; this.passives = {}; this.pacts = []; this.banished = new Set();
    this.combo = 0; this.comboT = 0; this.kindleTier = 0; this.bestCombo = 0;
    this.flare = 0; this.buffs = { overclock: 0, bloodrage: 0, shatter: 0, invuln: 0 };
    this.shake = 0; this.timeScale = 1; this.slowT = 0;
    this.waveIdx = 0; this.eventIdx = 0; this.spawnAcc = 0; this.totemT = 0; this.eliteT = 0;
    this.boss = null; this.victory = false; this.endless = false; this.dead = false;
    this.paused = false;
    this.chunks = new Map();
    this.chestQueue = [];
    this.pressure = 1;
    this.prof = { weapons: 0, proj: 0, enemies: 0, fx: 0, pickups: 0, grid: 0 };
    this.weaponUid = 0;

    this.player = { x: 0, y: 0, hp: 100, iframes: 0, fx: 1, fy: 0, moving: false, bob: 0, hurtT: 0, r: 14 };
    this.recalcStats();
    this.player.hp = this.stats.maxHp;
    this.rerolls = this.stats.rerolls; this.banishes = this.stats.banishes;
    this.addWeapon(this.char.weapon);
    this.zoom = 1;
    this.resize();
  }

  // ---------- stats ----------
  recalcStats() {
    const s = { ...BASE_STATS };
    for (const k in META) { const l = save.meta[k] || 0; if (l) META[k].apply(s, l); }
    this.char.apply(s);
    for (const k in this.passives) PASSIVES[k].apply(s, this.passives[k]);
    for (const p of this.pacts) PACTS[p].apply(s);
    if (s.overcharge) { /* not used */ }
    const oc = this.overcharge || 0;
    s.might += oc * 0.08; s.cooldown *= Math.pow(0.97, oc); s.area += oc * 0.03; s.maxHp += oc * 5;
    s.cooldown = Math.max(s.cooldown, 0.25);
    const prevMax = this.stats ? this.stats.maxHp : s.maxHp;
    this.stats = s;
    if (this.player && s.maxHp > prevMax) this.player.hp += s.maxHp - prevMax;
    if (this.player) this.player.hp = Math.min(this.player.hp, s.maxHp);
  }

  // effective stats for a weapon part, including temporary buffs
  eff(part) {
    const b = part.base, s = this.stats, B = this.buffs;
    const might = s.might * (B.bloodrage > 0 ? 2 : 1);
    const cdm = s.cooldown * (B.overclock > 0 ? 0.33 : 1);
    const o = part._eff || (part._eff = {});
    o.dmg = b.dmg * might;
    o.cd = b.cd * cdm;
    o.amount = b.amount != null ? b.amount + s.amount : 0;
    o.area = (b.area || 1) * s.area;
    o.speed = (b.speed || 1) * s.projSpeed;
    o.duration = (b.duration || 1) * s.duration;
    o.pierce = b.pierce || 1;
    o.chains = b.chains || 0;
    o.knock = b.knock || 0;
    o.freeze = b.freeze || 0;
    o.explode = b.explode || 0;
    o.permanent = !!b.permanent;
    o.zap = !!b.zap;
    o.pierceAll = !!b.pierceAll;
    return o;
  }

  // ---------- inventory ----------
  addWeapon(id) {
    const w = { id, level: 1, fused: false, wid: ++this.weaponUid, dmgDone: 0, kills: 0, parts: [] };
    w.parts.push({ behavior: WEAPONS[id].behavior, base: weaponStatsAt(id, 1), state: {}, w });
    this.weapons.push(w);
    return w;
  }
  levelWeapon(id) {
    const w = this.weapons.find((x) => x.id === id);
    if (!w || w.fused) return;
    w.level++;
    w.parts[0].base = weaponStatsAt(id, w.level);
  }
  addPassive(id) { this.passives[id] = (this.passives[id] || 0) + 1; this.recalcStats(); }

  availableFusions() {
    const res = [];
    for (const fid in FUSIONS) {
      const [a, b] = FUSIONS[fid].parents;
      const wa = this.weapons.find((w) => w.id === a && !w.fused), wb = this.weapons.find((w) => w.id === b && !w.fused);
      if (wa && wb && wa.level >= MAX_WEAPON_LEVEL && wb.level >= MAX_WEAPON_LEVEL) res.push(fid);
    }
    return res;
  }
  fuse(fid) {
    const F = FUSIONS[fid];
    const parts = [];
    let dmgDone = 0;
    for (const pid of F.parents) {
      const i = this.weapons.findIndex((w) => w.id === pid);
      const w = this.weapons[i];
      dmgDone += w.dmgDone;
      for (const part of w.parts) BEHAVIORS[part.behavior].dispose?.(this, part);
      this.weapons.splice(i, 1);
      const base = weaponStatsAt(pid, MAX_WEAPON_LEVEL);
      const bo = F.boost[pid] || {};
      for (const k in bo) {
        if (k === 'dmgMul') base.dmg *= bo[k];
        else if (k === 'areaMul') base.area = (base.area || 1) * bo[k];
        else if (k === 'cdMul') base.cd *= bo[k];
        else if (typeof bo[k] === 'boolean') base[k] = bo[k];
        else base[k] = (base[k] || 0) + bo[k];
      }
      parts.push({ behavior: WEAPONS[pid].behavior, base, state: {}, w: null });
    }
    const w = { id: fid, level: MAX_WEAPON_LEVEL, fused: true, wid: ++this.weaponUid, dmgDone, kills: 0, parts };
    for (const p of parts) p.w = w;
    this.weapons.push(w);
    save.fusions[fid] = true; persist();
    sfx.fusion();
    this.flash(0xffe0a0, 0.7);
    this.shake = Math.max(this.shake, 18);
    this.burst(this.player.x, this.player.y, 80, [0xffd060, 0xff7a20, 0xffffff], 500, 1.2);
    this.shockwave(this.player.x, this.player.y, 0xffc060, 900, 0.8);
    this.ui.toast(`ASCENDED: ${F.name}`, 'fusion');
  }

  // ---------- level-up drafting ----------
  buildChoices() {
    const opts = [];
    const nWeapons = this.weapons.length, nPassives = Object.keys(this.passives).length;
    for (const w of this.weapons) if (!w.fused && w.level < MAX_WEAPON_LEVEL) opts.push({ kind: 'weapon', id: w.id, weight: 1.6 });
    if (nWeapons < MAX_WEAPONS) for (const id in WEAPONS) {
      if (this.banished.has(id)) continue;
      if (this.weapons.some((w) => w.id === id)) continue;
      // fused-away parents cannot be re-taken
      if (this.weapons.some((w) => w.fused && FUSIONS[w.id].parents.includes(id))) continue;
      opts.push({ kind: 'weapon', id, weight: 1 });
    }
    for (const id in PASSIVES) {
      if (this.banished.has(id)) continue;
      const l = this.passives[id] || 0;
      if (l >= PASSIVES[id].max) continue;
      if (!l && nPassives >= MAX_PASSIVES) continue;
      opts.push({ kind: 'passive', id, weight: l ? 1.3 : 0.9 });
    }
    const count = 3 + (Math.random() < (this.stats.luck - 1) * 0.6 ? 1 : 0);
    const picks = [];
    while (picks.length < count && opts.length) {
      let tot = 0; for (const o of opts) tot += o.weight;
      let r = Math.random() * tot, i = 0;
      for (; i < opts.length; i++) { r -= opts[i].weight; if (r <= 0) break; }
      picks.push(opts.splice(Math.min(i, opts.length - 1), 1)[0]);
    }
    if (this.time > 100 && this.pacts.length < 3 && Math.random() < 0.09 * this.stats.luck) {
      const avail = Object.keys(PACTS).filter((p) => !this.pacts.includes(p));
      if (avail.length) {
        const pact = { kind: 'pact', id: avail[(Math.random() * avail.length) | 0] };
        if (picks.length >= count) picks[picks.length - 1] = pact; else picks.push(pact);
      }
    }
    if (!picks.length) {
      picks.push({ kind: 'overcharge', id: 'overcharge' }, { kind: 'heal', id: 'heal' }, { kind: 'cinderBag', id: 'cinderBag' });
    }
    return picks.map((p) => this.describeChoice(p));
  }

  describeChoice(p) {
    if (p.kind === 'weapon') {
      const w = this.weapons.find((x) => x.id === p.id);
      const def = WEAPONS[p.id];
      const lvl = w ? w.level + 1 : 1;
      let desc = w ? describeDelta(def.levels[w.level - 1]) : def.desc;
      const fp = fusionPartnerOf(p.id);
      let hint = '';
      if (fp) {
        const has = this.weapons.find((x) => x.id === fp.partner);
        hint = `Fuses with ${WEAPONS[fp.partner].name}${has ? ' ✓' : ''} → ${save.fusions[fp.fusion] ? FUSIONS[fp.fusion].name : '???'}`;
      }
      return { ...p, name: def.name, level: lvl, isNew: !w, desc, hint, icon: p.id, max: lvl >= MAX_WEAPON_LEVEL };
    }
    if (p.kind === 'passive') {
      const def = PASSIVES[p.id], l = (this.passives[p.id] || 0) + 1;
      return { ...p, name: def.name, level: l, isNew: l === 1, desc: def.desc, icon: p.id, max: l >= def.max };
    }
    if (p.kind === 'pact') return { ...p, name: PACTS[p.id].name, desc: PACTS[p.id].desc, icon: 'pact', hint: 'A dark pact. Permanent for this run.' };
    if (p.kind === 'overcharge') return { ...p, name: 'Overcharge', desc: '+8% damage, -3% cooldowns, +3% area, +5 max health. Stacks forever.', icon: 'overcharge' };
    if (p.kind === 'heal') return { ...p, name: 'Rekindle', desc: 'Restore 50% health.', icon: 'heal' };
    if (p.kind === 'cinderBag') return { ...p, name: 'Cinder Hoard', desc: '+40 cinders.', icon: 'cinderBag' };
    return p;
  }

  applyChoice(c) {
    if (c.kind === 'weapon') {
      if (this.weapons.some((w) => w.id === c.id)) this.levelWeapon(c.id); else this.addWeapon(c.id);
    } else if (c.kind === 'passive') this.addPassive(c.id);
    else if (c.kind === 'pact') { this.pacts.push(c.id); this.recalcStats(); this.flash(0xff1040, 0.4); this.ui.toast(c.name.toUpperCase(), 'pact'); }
    else if (c.kind === 'overcharge') { this.overcharge = (this.overcharge || 0) + 1; this.recalcStats(); }
    else if (c.kind === 'heal') this.heal(this.stats.maxHp * 0.5, true);
    else if (c.kind === 'cinderBag') this.addCinders(40, false);
  }

  // chest contents: fusions first, then upgrades to owned items
  rollChest(minItems = 1) {
    const L = this.stats.luck;
    let n = 1;
    const r = Math.random();
    if (r < 0.05 * L) n = 5; else if (r < 0.22 * L) n = 3;
    n = Math.max(n, minItems);
    const items = [];
    for (const fid of this.availableFusions()) { if (items.length >= n) break; items.push({ kind: 'fusion', id: fid }); }
    let guard = 0;
    while (items.length < n && guard++ < 40) {
      const pool = [];
      for (const w of this.weapons) {
        if (w.fused) continue;
        const pending = items.filter((x) => x.id === w.id).length;
        if (w.level + pending < MAX_WEAPON_LEVEL) pool.push({ kind: 'weapon', id: w.id });
      }
      for (const id in this.passives) {
        const pending = items.filter((x) => x.id === id).length;
        if (this.passives[id] + pending < PASSIVES[id].max) pool.push({ kind: 'passive', id });
      }
      if (!pool.length) { items.push({ kind: 'overcharge', id: 'overcharge' }); continue; }
      items.push(pool[(Math.random() * pool.length) | 0]);
    }
    const cinders = Math.round(rand(15, 40) * n * this.stats.greed);
    return { items: items.map((it) => (it.kind === 'fusion' ? { ...it, name: FUSIONS[it.id].name, desc: FUSIONS[it.id].desc, icon: it.id } : this.describeChoice(it))), cinders };
  }
  applyChest(res) {
    for (const it of res.items) {
      if (it.kind === 'fusion') this.fuse(it.id);
      else this.applyChoice(it);
    }
    this.addCinders(res.cinders, false);
  }

  // ---------- helpers ----------
  resize() {
    const w = this.app.screen.width, h = this.app.screen.height;
    this.zoom = Math.max(0.6, Math.min(1.25, Math.min(w, h) / 760));
    this.ground.width = w; this.ground.height = h;
    this.vignette.width = w; this.vignette.height = h;
    this.hurtVignette.width = w; this.hurtVignette.height = h;
    this.halfW = w / this.zoom / 2; this.halfH = h / this.zoom / 2;
  }
  inView(x, y, m = 0) {
    return Math.abs(x - this.player.x) < this.halfW + m && Math.abs(y - this.player.y) < this.halfH + m;
  }
  flash(color, a) { this.flashColor = color; this.flashAlpha = Math.max(this.flashAlpha, a); }

  enemiesIn(x, y, r, out) { out.length = 0; return this.grid.query(x, y, r, out); }

  nearestEnemy(x, y, maxR = 99999, skip = null) {
    let best = null, bd = maxR * maxR;
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (!e.alive || e.inert || e === skip) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  randomVisibleEnemy() {
    const es = this.enemies;
    if (!es.length) return null;
    for (let t = 0; t < 14; t++) {
      const e = es[(Math.random() * es.length) | 0];
      if (e.alive && !e.inert && this.inView(e.x, e.y, -20)) return e;
    }
    return this.nearestEnemy(this.player.x, this.player.y, 900);
  }

  // ---------- FX ----------
  spawnFx(tex, x, y, o) {
    if (this.fx.length >= MAX_FX) return null;
    const layer = o.add === false ? this.L.fx : this.L.fxAdd;
    const p = layer.add(tex, x, y);
    p.tint = o.tint ?? 0xffffff;
    p.rotation = o.rot ?? 0;
    const f = this.fxPool.pop() || {};
    f.p = p; f.layer = layer; f.vx = o.vx || 0; f.vy = o.vy || 0; f.life = o.life; f.max = o.life;
    f.drag = o.drag ?? 3; f.grav = o.grav || 0; f.s0 = o.s0 ?? 1; f.s1 = o.s1 ?? 0; f.a0 = o.a ?? 1;
    f.spin = o.spin || 0; f.sx = o.sx || 0;
    p.scaleX = f.sx || f.s0; p.scaleY = f.s0; p.alpha = f.a0;
    this.fx.push(f);
    return f;
  }
  burst(x, y, n, colors, speed = 220, size = 0.7, tex = 'spark') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = speed * (0.3 + Math.random() * 0.7);
      this.spawnFx(T[tex], x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.25, 0.6), drag: 4,
        s0: size * rand(0.6, 1.2), s1: 0, tint: colors[(Math.random() * colors.length) | 0], rot: a, spin: rand(-8, 8),
      });
    }
  }
  shockwave(x, y, tint, radius, life = 0.45) {
    this.spawnFx(T.ring, x, y, { life, s0: 0.1, s1: radius / 58, tint, a: 0.9, drag: 0 });
  }
  dmgNumber(x, y, val, crit) {
    if (!save.settings.numbers || this.numbers.length > 140) return;
    const str = String(Math.max(1, Math.round(val))) + (crit ? '!' : '');
    const sc = crit ? 0.8 : 0.55;
    const n = this.numPool.pop() || { parts: [] };
    const parts = n.parts;
    parts.length = 0;
    const w = 11 * sc * 1.4;
    for (let i = 0; i < str.length; i++) {
      const p = this.L.nums.add(T['d' + str[i]], x + (i - (str.length - 1) / 2) * w, y);
      p.scaleX = p.scaleY = sc;
      p.tint = crit ? 0xffd040 : 0xffffff;
      parts.push(p);
    }
    n.x = x; n.y = y; n.vy = -60; n.life = 0.7; n.sc = sc; n.w = w;
    this.numbers.push(n);
  }

  // ---------- enemies ----------
  spawnEnemy(type, x, y, o = {}) {
    if (this.enemies.length >= MAX_ENEMIES && !o.force) return null;
    const d = ENEMIES[type];
    if (!d._t) {
      const t0 = T[d.tex + '0'] || T[d.tex], t1 = T[d.tex + '1'] || t0;
      const w0 = T[d.tex + '0_w'] || T[d.tex + '_w'], w1 = T[d.tex + '1_w'] || w0;
      d._t = [t0, t1]; d._w = [w0, w1];
    }
    const elite = !!o.elite;
    let hp = d.hp;
    if (d.boss) hp = d.hp * (0.45 + this.level * 0.036) * this.stats.enemyHp * (this.endless ? enemyHpScale(this.time) / 5 : 1);
    else if (!d.inert) hp = d.hp * enemyHpScale(this.time) * this.stats.enemyHp * (elite ? 14 : 1);
    const scale = (elite ? 1.55 : 1) * (o.scale || 1);
    const e = {
      type, d, x, y, kx: 0, ky: 0, hp, maxHp: hp, alive: true, uid: uidCounter++,
      speed: d.speed * (elite ? 0.9 : 1) * rand(0.92, 1.08), dmg: d.boss ? d.dmg : d.dmg * (elite ? 1.3 : 1) * (1 + this.time / 900),
      r: d.r * scale, scale, xp: d.xp * (elite ? 10 : 1), elite, boss: !!d.boss, inert: !!d.inert,
      flash: 0, slowT: 0, freezeT: 0, anim: Math.random() * 10, frame: 0, t: 0, state: 0, stT: d.boss ? 3.5 : rand(1, 3),
      dirX: 0, dirY: 0, rush: o.rush || null, life: o.life || 0, phase: Math.random() * TAU, _q: 0, glow: null,
    };
    e.p = this.L.enemies.add(d._t[0], x, y);
    e.p.anchorY = 0.62;
    e.p.scaleX = e.p.scaleY = scale;
    if (d.alpha) e.p.alpha = d.alpha;
    if (elite || e.boss) {
      e.glow = this.L.glowUnder.add(T.softglow, x, y);
      e.glow.tint = e.boss ? 0xff4060 : 0xffc040;
      e.glow.scaleX = e.glow.scaleY = (e.r * 3.2) / 64;
      e.glow.alpha = 0.6;
    }
    if (elite) e.p.tint = 0xffe0a0;
    this.enemies.push(e);
    if (e.boss) {
      this.boss = e;
      this.ui.toast(`${bossName(type)} AWAKENS`, 'boss');
      sfx.bossWarn();
      this.shake = Math.max(this.shake, 14);
    }
    return e;
  }

  spawnPointOffscreen(margin = 80) {
    const hw = this.halfW + margin, hh = this.halfH + margin, p = this.player;
    const side = Math.random() * (hw + hh) * 2;
    if (side < hw * 2) return { x: p.x - hw + side, y: p.y + (Math.random() < 0.5 ? -hh : hh) };
    return { x: p.x + (Math.random() < 0.5 ? -hw : hw), y: p.y - hh + (side - hw * 2) };
  }

  removeEnemy(e) {
    e.alive = false;
    this.L.enemies.kill(e.p);
    if (e.glow) this.L.glowUnder.kill(e.glow);
    if (this.boss === e) this.boss = null;
  }

  damage(e, amount, o = null) {
    if (!e.alive) return 0;
    let dmg = amount * rand(0.92, 1.08);
    let crit = false;
    if (Math.random() < this.stats.crit) { dmg *= this.stats.critMul; crit = true; }
    if (this.buffs.shatter > 0 && e.freezeT > 0) dmg *= 2;
    e.hp -= dmg;
    e.flash = 0.08;
    if (o) {
      if (o.w) o.w.dmgDone += dmg;
      if (o.knock && !e.boss) {
        let dx = e.x - (o.fx ?? this.player.x), dy = e.y - (o.fy ?? this.player.y);
        const dl = Math.hypot(dx, dy) || 1;
        const k = o.knock * 14 * (1 - (e.d.knockRes || 0)) * (e.elite ? 0.3 : 1);
        e.kx += (dx / dl) * k; e.ky += (dy / dl) * k;
      }
      if (o.freeze && Math.random() < o.freeze && !e.boss) e.freezeT = Math.max(e.freezeT, 1.5);
      if (o.slow) { e.slowT = Math.max(e.slowT, o.slow); }
    }
    if (this.buffs.bloodrage > 0) this.heal(dmg * 0.004, false);
    if (!e.inert) this.dmgNumber(e.x + rand(-6, 6), e.y - e.r - 6, dmg, crit);
    sfx.hit();
    if (e.hp <= 0) this.killEnemy(e, o && o.w);
    return dmg;
  }

  killEnemy(e, w) {
    this.removeEnemy(e);
    const x = e.x, y = e.y;
    if (e.inert) {
      this.burst(x, y, 24, [0xffd060, 0xfff0c0, 0x8060ff], 260, 0.8);
      this.spawnFx(T.glow, x, y, { life: 0.35, s0: 1.5, s1: 3, tint: 0xffc060 });
      const roll = weighted([['heart', this.stats.noHeal ? 0 : 25], ['magnet', 18], ['bomb', 14], ['freeze', 14], ['flareorb', 16], ['cinderbag', 13]]);
      this.dropPickup(roll === 'cinderbag' ? 'cinder' : roll, x, y, roll === 'cinderbag' ? 25 : 1);
      sfx.pickup();
      return;
    }
    this.kills++;
    if (w) w.kills++;
    // kindle combo
    this.combo++; this.comboT = 2.8;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    const nt = kindleTierOf(this.combo);
    if (nt > this.kindleTier) {
      this.kindleTier = nt;
      sfx.kindleUp(nt);
      this.ui.kindlePop(KINDLE_TIERS[nt].mul);
      this.burst(this.player.x, this.player.y, 24, [0xffa030, 0xffe080], 300, 0.8);
    }
    this.flare = Math.min(100, this.flare + (e.boss ? 35 : e.elite ? 8 : 0.32) * this.stats.flareGain);
    // death fx
    const col = ENEMY_COLORS[e.type] || 0xb080ff;
    const big = e.boss ? 4 : e.elite ? 2 : 1;
    if ((this.fx.length < MAX_FX * 0.8 && this.deathFxBudget-- > 0) || big > 1) {
      this.burst(x, y, 5 * big, [col, 0xffffff], 160 * big, 0.6, 'shard');
      this.spawnFx(T.glow, x, y, { life: 0.22, s0: 0.5 * big * e.scale, s1: 1.4 * big * e.scale, tint: col, a: 0.8 });
      this.spawnFx(T.smoke, x, y, { life: 0.5, s0: 0.6 * e.scale, s1: 1.3 * e.scale, tint: 0x302040, a: 0.5, add: false, vy: -20 });
    }
    sfx.kill();
    // drops
    if (e.boss) {
      this.dropPickup('gem', x, y, e.xp);
      for (let i = 0; i < 12; i++) this.dropPickup('cinder', x + rand(-60, 60), y + rand(-60, 60), 5);
      this.dropPickup('chest', x, y, e.d.final ? 5 : 3);
      this.slowT = 1.2;
      this.shake = Math.max(this.shake, 30);
      this.flash(0xffffff, 0.8);
      this.burst(x, y, 120, [0xffd060, 0xff4060, 0xffffff], 700, 1.3);
      this.shockwave(x, y, 0xffffff, 1000, 1);
      sfx.boom();
      if (e.d.final && !this.victory) { this.victory = true; setTimeout(() => this.ui.showVictory(this), 1800); }
      return;
    }
    if (e.elite) {
      this.dropPickup('chest', x, y, 1);
      this.slowT = 0.35;
      this.shake = Math.max(this.shake, 10);
      this.burst(x, y, 40, [0xffd060, 0xffffff], 400, 1);
    }
    this.dropPickup('gem', x, y, e.xp);
    if (Math.random() < 0.012 * this.stats.luck) {
      const roll = weighted([['cinder', 62], ['heart', this.stats.noHeal ? 0 : 16], ['magnet', 5], ['bomb', 4], ['freeze', 4], ['flareorb', 7]]);
      this.dropPickup(roll, x + rand(-8, 8), y + rand(-8, 8), roll === 'cinder' ? 1 + ((Math.random() * 3) | 0) : 1);
    }
    if (e.d.split) {
      for (let i = 0; i < e.d.splitCount; i++) {
        const a = (i / e.d.splitCount) * TAU;
        const c = this.spawnEnemy(e.d.split, x + Math.cos(a) * 10, y + Math.sin(a) * 10, { force: true });
        if (c) { c.kx = Math.cos(a) * 200; c.ky = Math.sin(a) * 200; }
      }
    }
  }

  // ---------- pickups ----------
  dropPickup(type, x, y, value = 1) {
    if (type === 'gem') {
      if (this.gemCount >= GEM_CAP) {
        // overflow: pour value into the vault gem
        if (this.vault && this.vault.alive) { this.vault.value += value; this.setGemTex(this.vault); return; }
      }
    }
    let tex;
    if (type === 'gem') tex = T.gem0;
    else if (type === 'flareorb') tex = T.flareorb;
    else tex = T[type];
    const pk = { type, x, y, value, alive: true, attract: false, vx: rand(-60, 60), vy: rand(-90, -30), t: 0, pop: 0.25 };
    pk.p = this.L.pickups.add(tex, x, y);
    if (type === 'gem') { this.setGemTex(pk); this.gemCount = (this.gemCount || 0) + 1; if (this.gemCount >= GEM_CAP && (!this.vault || !this.vault.alive)) this.vault = pk; }
    if (type === 'chest') pk.pop = 0;
    if (type === 'cinder' && value >= 10) pk.p.scaleX = pk.p.scaleY = 1.6;
    this.pickups.push(pk);
    return pk;
  }
  setGemTex(pk) {
    const v = pk.value;
    pk.p.texture = v >= 200 ? T.gem4 : v >= 40 ? T.gem3 : v >= 10 ? T.gem2 : v >= 3 ? T.gem1 : T.gem0;
    pk.p.scaleX = pk.p.scaleY = v >= 200 ? 1.2 : v >= 40 ? 1.1 : 0.9;
  }

  collect(pk) {
    pk.alive = false;
    this.L.pickups.kill(pk.p);
    const P = this.player;
    switch (pk.type) {
      case 'gem': {
        this.gemCount--;
        if (this.vault === pk) this.vault = null;
        this.gainXp(pk.value);
        sfx.gem(this.combo);
        this.spawnFx(T.glow, P.x, P.y - 14, { life: 0.18, s0: 0.3, s1: 0.7, tint: 0x80c0ff, a: 0.5 });
        break;
      }
      case 'cinder': this.addCinders(pk.value, true); sfx.cinder(); break;
      case 'heart': this.heal(this.stats.maxHp * 0.3, true); break;
      case 'magnet':
        for (const g of this.pickups) if (g.type === 'gem' || g.type === 'cinder') g.attract = true;
        sfx.pickup(); this.shockwave(P.x, P.y, 0x80b0ff, 600); this.ui.toast('LODESTAR', 'pickup');
        break;
      case 'bomb': {
        sfx.bomb(); this.flash(0xfff0c0, 0.9); this.shake = 26;
        this.shockwave(P.x, P.y, 0xffd060, 1100, 0.7);
        const list = this.enemies.slice();
        for (const e of list) {
          if (!e.alive || e.inert || !this.inView(e.x, e.y, 60)) continue;
          if (e.boss) this.damage(e, e.maxHp * 0.06);
          else if (e.elite) this.damage(e, e.maxHp * 0.3);
          else this.damage(e, e.hp + 1);
        }
        this.ui.toast('SUNBURST', 'pickup');
        break;
      }
      case 'freeze':
        sfx.freeze(); this.flash(0x80e0ff, 0.5);
        for (const e of this.enemies) if (!e.inert) e.freezeT = Math.max(e.freezeT, e.boss ? 2.5 : 7);
        this.ui.toast('STILLWATER', 'pickup');
        break;
      case 'flareorb': this.flare = Math.min(100, this.flare + 50); sfx.pickup(); break;
      case 'chest':
        sfx.pickup();
        this.chestQueue.push(pk.value);
        break;
    }
  }

  gainXp(v) {
    const mul = this.stats.growth * KINDLE_TIERS[this.kindleTier].mul;
    this.xp += v * mul;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level);
      this.pendingLevels++;
    }
  }
  addCinders(v, useKindle) {
    this.cinders += Math.max(1, Math.round(v * this.stats.greed * (useKindle ? KINDLE_TIERS[this.kindleTier].mul : 1)));
  }
  heal(v, show) {
    const P = this.player;
    if (this.stats.noHeal && show) return;
    const before = P.hp;
    P.hp = Math.min(this.stats.maxHp, P.hp + v);
    if (show && P.hp > before) {
      sfx.heal();
      this.burst(P.x, P.y - 20, 16, [0x60ff90, 0xc0ffd0], 160, 0.6);
    }
  }

  hurtPlayer(amount, src = '?') {
    const P = this.player;
    if (P.iframes > 0 || this.buffs.invuln > 0 || this.dead) return;
    (this.dmgLog || (this.dmgLog = {}))[src] = (this.dmgLog[src] || 0) + amount;
    this.lastHitBy = src;
    const s = this.stats;
    const dmg = Math.max(1, amount * (1 - Math.min(0.5, s.armor * 0.03)) - s.armor);
    P.hp -= dmg;
    P.iframes = 0.55; P.hurtT = 0.25;
    this.shake = Math.max(this.shake, 6);
    this.hurtFlash = 0.5;
    sfx.hurt();
    if (P.hp <= 0) {
      if (s.revivals > (this.usedRevivals || 0)) {
        this.usedRevivals = (this.usedRevivals || 0) + 1;
        P.hp = s.maxHp * 0.5; P.iframes = 3;
        this.flash(0xffa040, 1);
        this.ui.toast('SECOND WICK', 'pickup');
        this.triggerFlare('supernova', true);
      } else {
        this.dead = true;
        sfx.death();
        this.burst(P.x, P.y, 80, [0xff8030, 0xffd080, 0xffffff], 400, 1);
        this.playerSprite.visible = false;
        setTimeout(() => this.ui.showResults(this, false), 1400);
      }
    }
  }

  // ---------- flare (character ultimate) ----------
  triggerFlare(kind = this.char.flare, free = false) {
    if (!free) { if (this.flare < 100) return; this.flare = 0; }
    const P = this.player;
    sfx.flare();
    this.shake = Math.max(this.shake, 20);
    const might = this.stats.might;
    switch (kind) {
      case 'supernova': {
        this.flash(0xffb040, 0.7);
        this.novas = this.novas || [];
        this.novas.push({ x: P.x, y: P.y, r: 0, max: 900, dmg: (60 + this.level * 12) * might, hit: new Set(), t: 0 });
        this.shockwave(P.x, P.y, 0xffa030, 900, 0.9);
        this.shockwave(P.x, P.y, 0xffffff, 700, 0.7);
        this.burst(P.x, P.y, 120, [0xffa030, 0xffe080, 0xff5020], 900, 1.2);
        break;
      }
      case 'absoluteZero':
        this.flash(0xa0f0ff, 0.8);
        for (const e of this.enemies) if (!e.inert) e.freezeT = Math.max(e.freezeT, e.boss ? 2.5 : 5);
        this.buffs.shatter = 5;
        this.shockwave(P.x, P.y, 0x80e0ff, 1100, 0.9);
        this.burst(P.x, P.y, 100, [0xa0f0ff, 0xffffff], 800, 1, 'shard');
        break;
      case 'overclock':
        this.flash(0x80ffd0, 0.5);
        this.buffs.overclock = 7;
        this.shockwave(P.x, P.y, 0x80ffd0, 500, 0.6);
        break;
      case 'bloodrage':
        this.flash(0xff2030, 0.6);
        this.buffs.bloodrage = 8;
        this.shockwave(P.x, P.y, 0xff3040, 600, 0.6);
        this.burst(P.x, P.y, 60, [0xff2030, 0xff8080], 500, 1);
        break;
      case 'moonfall': {
        this.flash(0xd0b0ff, 0.6);
        this.buffs.invuln = 3;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          this.addProjectile({
            tex: T.glaive, layer: this.L.projAdd, x: P.x, y: P.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
            life: 2.2, dmg: (30 + this.level * 4) * might, pierce: 9999, r: 26, rehit: 0.3, spin: 18, scale: 1.5,
            curve: 2.2, knock: 10, tint: 0xd8c8ff,
          });
        }
        break;
      }
    }
    this.ui.toast(this.char.flareName.toUpperCase(), 'flare');
  }

  // ---------- projectiles ----------
  addProjectile(o) {
    const p = (o.layer || this.L.projAdd).add(o.tex, o.x, o.y);
    p.scaleX = p.scaleY = o.scale || 1;
    if (o.tint != null) p.tint = o.tint;
    const pr = this.projPool.pop() || { hits: new Map() };
    pr.hits.clear();
    pr.p = p; pr.layer = o.layer || this.L.projAdd; pr.x = o.x; pr.y = o.y; pr.vx = o.vx; pr.vy = o.vy;
    pr.life = o.life; pr.max = o.life; pr.dmg = o.dmg; pr.pierce = o.pierce || 1; pr.r = o.r || 8; pr.w = o.w || null;
    pr.rehit = o.rehit || 0; pr.homing = o.homing || 0; pr.target = o.target || null; pr.explode = o.explode || 0;
    pr.freeze = o.freeze || 0; pr.slow = o.slow || 0; pr.knock = o.knock || 0; pr.spin = o.spin || 0;
    pr.faceVel = !!o.faceVel; pr.returnTo = !!o.returnTo; pr.retT = o.retT || 0; pr.curve = o.curve || 0;
    pr.trail = o.trail || 0; pr.trailTint = o.trailTint ?? 0xffffff; pr.trailT = 0; pr.alive = true;
    pr.speed = Math.hypot(o.vx, o.vy); pr.onHit = o.onHit || null; pr.scale = o.scale || 1; pr.fade = !!o.fade; pr.accel = o.accel || 0;
    if (pr.faceVel) p.rotation = Math.atan2(pr.vy, pr.vx);
    this.projectiles.push(pr);
    return pr;
  }

  explodeAt(x, y, radius, dmg, w, tint = 0xff8030, knock = 12) {
    const list = this.enemiesIn(x, y, radius, this.qExp);
    for (const e of list) this.damage(e, dmg, { w, knock, fx: x, fy: y });
    this.spawnFx(T.glow, x, y, { life: 0.3, s0: radius / 40, s1: radius / 18, tint, a: 0.9 });
    this.shockwave(x, y, tint, radius, 0.3);
    if (this.fx.length < MAX_FX * 0.7) this.burst(x, y, 8, [tint, 0xffffff], radius * 3, 0.6);
    sfx.boom();
  }

  updateProjectiles(dt) {
    const prs = this.projectiles, now = this.time, P = this.player;
    const out = this.qb;
    for (let i = prs.length - 1; i >= 0; i--) {
      const pr = prs[i];
      pr.life -= dt;
      if (pr.life <= 0 || !pr.alive) {
        if (pr.explode && pr.alive) this.explodeAt(pr.x, pr.y, pr.explode, pr.dmg * 0.7, pr.w);
        pr.layer.kill(pr.p);
        pr.p = null; pr.target = null; pr.w = null; pr.onHit = null;
        this.projPool.push(pr);
        prs[i] = prs[prs.length - 1]; prs.pop();
        continue;
      }
      // steering
      if (pr.homing) {
        if (!pr.target || !pr.target.alive) pr.target = this.nearestEnemy(pr.x, pr.y, 500);
        if (pr.target) {
          const dx = pr.target.x - pr.x, dy = pr.target.y - pr.y, dl = Math.hypot(dx, dy) || 1;
          const t = Math.min(1, pr.homing * dt);
          pr.vx += ((dx / dl) * pr.speed - pr.vx) * t;
          pr.vy += ((dy / dl) * pr.speed - pr.vy) * t;
        }
      }
      if (pr.curve) {
        const c = Math.cos(pr.curve * dt), s = Math.sin(pr.curve * dt);
        const vx = pr.vx * c - pr.vy * s; pr.vy = pr.vx * s + pr.vy * c; pr.vx = vx;
      }
      if (pr.returnTo) {
        pr.retT -= dt;
        if (pr.retT <= 0) {
          const dx = P.x - pr.x, dy = P.y - pr.y, dl = Math.hypot(dx, dy) || 1;
          pr.vx += (dx / dl) * pr.speed * 4 * dt; pr.vy += (dy / dl) * pr.speed * 4 * dt;
          const sp = Math.hypot(pr.vx, pr.vy);
          if (sp > pr.speed * 1.3) { pr.vx *= (pr.speed * 1.3) / sp; pr.vy *= (pr.speed * 1.3) / sp; }
          if (dl < 24 && pr.retT < -0.15) { pr.life = 0; pr.explode = 0; }
        }
      }
      if (pr.accel) { pr.vx *= 1 + pr.accel * dt; pr.vy *= 1 + pr.accel * dt; }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      const p = pr.p;
      p.x = pr.x; p.y = pr.y;
      if (pr.spin) p.rotation += pr.spin * dt;
      else if (pr.faceVel) p.rotation = Math.atan2(pr.vy, pr.vx);
      if (pr.fade) p.alpha = Math.min(1, pr.life / (pr.max * 0.3));
      if (pr.trail) {
        pr.trailT -= dt;
        if (pr.trailT <= 0 && this.fx.length < MAX_FX * 0.75) {
          pr.trailT = pr.trail;
          this.spawnFx(T.dot, pr.x + rand(-3, 3), pr.y + rand(-3, 3), { life: 0.3, s0: 1.4 * pr.scale, s1: 0, tint: pr.trailTint, a: 0.8, vx: -pr.vx * 0.1, vy: -pr.vy * 0.1 });
        }
      }
      // collision
      out.length = 0;
      this.grid.query(pr.x, pr.y, pr.r, out);
      for (let k = 0; k < out.length; k++) {
        const e = out[k];
        const last = pr.hits.get(e.uid);
        if (last !== undefined && (pr.rehit === 0 || now - last < pr.rehit)) continue;
        pr.hits.set(e.uid, now);
        this.damage(e, pr.dmg, { w: pr.w, knock: pr.knock, fx: pr.x - pr.vx, fy: pr.y - pr.vy, freeze: pr.freeze, slow: pr.slow });
        if (pr.onHit) pr.onHit(this, pr, e);
        if (--pr.pierce <= 0) { pr.alive = false; if (pr.explode) { this.explodeAt(pr.x, pr.y, pr.explode, pr.dmg * 0.7, pr.w); pr.explode = 0; } break; }
      }
    }
  }

  // ---------- main update ----------
  update(rawDt) {
    if (this.paused || this.dead && this.deadT > 3) return;
    if (this.slowT > 0) { this.slowT -= rawDt; this.timeScale = 0.3; } else this.timeScale = 1;
    const dt = rawDt * this.timeScale;
    if (!this.dead) this.time += dt;
    const P = this.player, S = this.stats;

    // input
    if (consumePressed('Space') || consumePressed('KeyE')) this.triggerFlare();
    const pad = padButtons();
    if (pad.flare) this.triggerFlare();
    if (!this.dead) {
      const mv = moveVector();
      const spd = S.moveSpeed * (this.buffs.bloodrage > 0 ? 1.3 : 1);
      P.x += mv.x * spd * dt; P.y += mv.y * spd * dt;
      P.moving = mv.x !== 0 || mv.y !== 0;
      if (P.moving) { const l = Math.hypot(mv.x, mv.y); P.fx = mv.x / l; P.fy = mv.y / l; }
      P.iframes -= dt; P.hurtT -= dt;
      if (S.regen > 0) this.heal(S.regen * dt, false);
    } else this.deadT = (this.deadT || 0) + rawDt;

    for (const k in this.buffs) if (this.buffs[k] > 0) this.buffs[k] -= dt;

    // kindle decay
    if (this.combo > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) {
        if (this.kindleTier > 0) sfx.kindleLost();
        this.combo = 0; this.kindleTier = 0;
      }
    }

    this.deathFxBudget = 18;
    // grid
    const pf = this.prof, now = performance.now.bind(performance);
    let t0 = now();
    this.grid.clear();
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) if (es[i].alive) this.grid.insert(es[i]);

    let t1 = now(); pf.grid += t1 - t0; t0 = t1;
    if (!this.dead) {
      this.director(dt);
      for (const w of this.weapons) for (const part of w.parts) BEHAVIORS[part.behavior].update(this, part, this.eff(part), dt);
    }
    this.updateNovas(dt);
    t1 = now(); pf.weapons += t1 - t0; t0 = t1;
    this.updateProjectiles(dt);
    t1 = now(); pf.proj += t1 - t0; t0 = t1;
    this.updateEnemies(dt);
    this.updateEnemyShots(dt);
    t1 = now(); pf.enemies += t1 - t0; t0 = t1;
    this.updatePickups(dt);
    t1 = now(); pf.pickups += t1 - t0; t0 = t1;
    this.updateFx(dt);
    this.updateDecor();
    pf.fx += now() - t0;

    // level-ups (pause & draft)
    if (this.pendingLevels > 0 && !this.dead && !this.ui.modalOpen) {
      this.pendingLevels--;
      const choices = this.buildChoices();
      if (choices.every((c) => c.kind === 'overcharge' || c.kind === 'heal' || c.kind === 'cinderBag')) {
        // fully maxed build: power keeps climbing without interrupting the carnage
        this.applyChoice(choices.find((c) => c.kind === 'overcharge'));
        sfx.kindleUp(Math.min(6, (this.overcharge || 0) % 7));
        this.shockwave(P.x, P.y, 0xffd060, 260, 0.35);
        this.ui.toast('OVERCHARGE', 'kindle');
      } else {
        sfx.levelup();
        this.shockwave(P.x, P.y, 0x80d0ff, 400, 0.5);
        this.burst(P.x, P.y, 40, [0x80d0ff, 0xffffff, 0xffd060], 420, 0.9);
        this.ui.showLevelUp(this, choices);
      }
    } else if (this.chestQueue.length && !this.dead && !this.ui.modalOpen) {
      this.ui.showChest(this, this.rollChest(this.chestQueue.shift()));
    }
    setIntensity(Math.min(1, this.time / 600 + this.kindleTier * 0.08 + (this.boss ? 0.3 : 0)));
  }

  updateNovas(dt) {
    if (!this.novas) return;
    for (let i = this.novas.length - 1; i >= 0; i--) {
      const n = this.novas[i];
      n.t += dt; n.r = n.max * Math.min(1, n.t / 0.8);
      const list = this.enemiesIn(n.x, n.y, n.r, this.qNova);
      for (const e of list) {
        if (n.hit.has(e.uid)) continue;
        n.hit.add(e.uid);
        this.damage(e, e.boss ? n.dmg * 3 : n.dmg, { knock: 30, fx: n.x, fy: n.y });
      }
      if (n.t > 0.8) this.novas.splice(i, 1);
    }
  }

  director(dt) {
    const t = this.time, P = this.player;
    while (this.waveIdx + 1 < WAVES.length && t >= WAVES[this.waveIdx + 1].at) this.waveIdx++;
    const wave = WAVES[this.waveIdx];
    let rate = wave.rate, min = wave.min;
    if (t > 900) { const m = (t - 900) / 60; rate *= 1 + m * 0.25; min *= 1 + m * 0.15; }
    rate *= this.stats.curse; min *= this.stats.curse;
    if (this.boss) { rate *= 0.6; }
    let alive = 0;
    for (const e of this.enemies) if (!e.inert && e.alive) alive++;
    this.spawnAcc += rate * dt;
    // floor top-up is bounded by the wave's own rate so fast killers can't farm infinite spawns
    // Gloam Pressure: if the horde is being erased faster than it arrives, the dark pushes harder
    // so a strong build always has a tide to carve through (bounded by MAX_ENEMIES).
    if (t > 300 && alive < min * 0.4) this.pressure = Math.min(6, this.pressure + dt * 0.2);
    else if (alive > min * 0.8) this.pressure = Math.max(1, this.pressure - dt * 0.1);
    const late = this.pressure;
    this.spawnAcc += rate * (late - 1) * dt;
    if (alive < min) this.spawnAcc += Math.min((min - alive) * 2, rate * 2.5 * late) * dt;
    let n = Math.floor(this.spawnAcc);
    this.spawnAcc -= n;
    n = Math.min(n, Math.round(12 * late));
    for (let i = 0; i < n; i++) {
      const type = weightedObj(wave.pool);
      const sp = this.spawnPointOffscreen();
      this.spawnEnemy(type, sp.x, sp.y);
    }
    // scripted events
    while (this.eventIdx < EVENTS.length && t >= EVENTS[this.eventIdx].at) this.runEvent(EVENTS[this.eventIdx++]);
    // endless: loop events with escalation
    if (t > 900 && this.eventIdx >= EVENTS.length) {
      this.endlessT = (this.endlessT || 0) + dt;
      if (this.endlessT > 30) {
        this.endlessT = 0;
        const pool = ['ring', 'stampede', 'elite', 'elite'];
        const type = pool[(Math.random() * pool.length) | 0];
        const types = ['husk', 'sentinel', 'beetle', 'wraith', 'moth'];
        this.runEvent({ type, enemy: types[(Math.random() * types.length) | 0], count: 60 });
        if (Math.random() < 0.25) this.runEvent({ type: 'boss', enemy: ['matron', 'colossus'][(Math.random() * 2) | 0] });
      }
    }
    // periodic elites between scripted ones
    this.eliteT += dt;
    if (t > 120 && this.eliteT > Math.max(25, 60 - t / 30)) {
      this.eliteT = 0;
      const types = Object.keys(wave.pool);
      const sp = this.spawnPointOffscreen(40);
      this.spawnEnemy(types[(Math.random() * types.length) | 0], sp.x, sp.y, { elite: true, force: true });
    }
    // totems
    this.totemT -= dt;
    if (this.totemT <= 0) {
      this.totemT = 2;
      let c = 0;
      for (const e of this.enemies) if (e.inert) { if (Math.hypot(e.x - P.x, e.y - P.y) > 2200) this.removeEnemy(e); else c++; }
      if (c < 5) {
        const a = Math.random() * TAU, d = rand(700, 1500);
        this.spawnEnemy('totem', P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, { force: true });
      }
    }
  }

  runEvent(ev) {
    const P = this.player;
    if (ev.type === 'ring') {
      const R = Math.max(this.halfW, this.halfH) + 60;
      for (let i = 0; i < ev.count; i++) {
        const a = (i / ev.count) * TAU;
        this.spawnEnemy(ev.enemy, P.x + Math.cos(a) * R, P.y + Math.sin(a) * R, { force: true });
      }
      this.ui.toast('THE GLOAM CLOSES IN', 'warn');
    } else if (ev.type === 'stampede') {
      const a = Math.random() * TAU, dx = Math.cos(a), dy = Math.sin(a);
      const R = Math.max(this.halfW, this.halfH) + 100;
      const cnt = ev.count || ev.altCount;
      const enemy = ev.count ? ev.enemy : ev.alt;
      for (let i = 0; i < cnt; i++) {
        const off = (i / cnt - 0.5) * R * 2.2;
        const x = P.x - dx * R - dy * off + rand(-30, 30), y = P.y - dy * R + dx * off + rand(-30, 30);
        this.spawnEnemy(enemy, x, y, { force: true, rush: { x: dx, y: dy }, life: 14 });
      }
      this.ui.toast('STAMPEDE!', 'warn');
    } else if (ev.type === 'elite') {
      const sp = this.spawnPointOffscreen(40);
      this.spawnEnemy(ev.enemy, sp.x, sp.y, { elite: true, force: true });
    } else if (ev.type === 'boss') {
      const sp = this.spawnPointOffscreen(120);
      this.spawnEnemy(ev.enemy, sp.x, sp.y, { force: true });
    }
  }

  updateEnemies(dt) {
    const P = this.player, es = this.enemies, ES = this.stats.enemySpeed;
    const farX = this.halfW * 2 + 200, farY = this.halfH * 2 + 200;
    const kd = Math.exp(-9 * dt);
    let contactDmg = 0, contactSrc = '', contactBoss = null;
    for (let i = es.length - 1; i >= 0; i--) {
      const e = es[i];
      if (!e.alive) { es[i] = es[es.length - 1]; es.pop(); continue; }
      const p = e.p;
      if (e.inert) {
        e.anim += dt;
        p.y = e.y + Math.sin(e.anim * 2) * 2;
        if (e.flash > 0) { e.flash -= dt; p.texture = e.d._w[0]; } else p.texture = e.d._t[0];
        continue;
      }
      e.t += dt;
      let dx = P.x - e.x, dy = P.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist; dy /= dist;
      // relocate stragglers ahead of the player
      if (!e.boss && !e.rush && (Math.abs(P.x - e.x) > farX || Math.abs(P.y - e.y) > farY)) {
        const sp = this.spawnPointOffscreen();
        e.x = sp.x; e.y = sp.y;
        continue;
      }
      if (e.rush) { e.life -= dt; if (e.life <= 0) { this.removeEnemy(e); continue; } }

      let mvx = 0, mvy = 0;
      if (e.freezeT > 0) {
        e.freezeT -= dt;
        p.tint = 0x90e0ff;
      } else {
        if (!e.elite) p.tint = 0xffffff; else p.tint = 0xffe0a0;
        let sp = e.speed * ES * (e.slowT > 0 ? 0.5 : 1);
        if (e.slowT > 0) { e.slowT -= dt; p.tint = 0xb0d8ff; }
        if (e.rush) { mvx = e.rush.x * sp * 2.4; mvy = e.rush.y * sp * 2.4; }
        else if (e.d.charge) {
          // ram beetle: approach, wind up, dash
          if (e.state === 0) {
            mvx = dx * sp; mvy = dy * sp;
            e.stT -= dt;
            if (e.stT <= 0 && dist < 380) { e.state = 1; e.stT = 0.55; e.dirX = dx; e.dirY = dy; }
          } else if (e.state === 1) {
            e.stT -= dt; p.tint = 0xff8080;
            e.p.x += rand(-1.5, 1.5);
            if (e.stT <= 0) { e.state = 2; e.stT = 0.75; }
          } else {
            mvx = e.dirX * sp * 5; mvy = e.dirY * sp * 5; e.stT -= dt;
            if (this.fx.length < MAX_FX * 0.6 && Math.random() < 0.4) this.spawnFx(T.smoke, e.x, e.y + 8, { life: 0.4, s0: 0.4, s1: 0.8, tint: 0x504060, a: 0.4, add: false });
            if (e.stT <= 0) { e.state = 0; e.stT = rand(2, 3.5); }
          }
        } else if (e.d.ranged) {
          const want = dist > 280 ? 1 : dist < 200 ? -0.6 : 0;
          mvx = dx * sp * want + -dy * sp * 0.3; mvy = dy * sp * want + dx * sp * 0.3;
          e.stT -= dt;
          if (e.stT <= 0 && dist < 420 && this.inView(e.x, e.y, -30)) {
            e.stT = e.elite ? 1.8 : rand(3.2, 4.2);
            const n = e.elite ? 5 : 1;
            for (let k = 0; k < n; k++) {
              const a = Math.atan2(dy, dx) + (k - (n - 1) / 2) * 0.22;
              this.enemyShot(e.x, e.y - 10, Math.cos(a) * 140, Math.sin(a) * 140, e.dmg * 0.6);
            }
            this.spawnFx(T.glow, e.x, e.y - 10, { life: 0.25, s0: 0.4, s1: 1, tint: 0xd060ff, a: 0.8 });
          }
        } else if (e.boss) {
          mvx = dx * sp; mvy = dy * sp;
          this.bossAI(e, dt, dx, dy, dist);
        } else {
          mvx = dx * sp; mvy = dy * sp;
          if (e.d.wobble) { const w = Math.sin(e.t * 6 + e.phase) * sp * 0.7; mvx += -dy * w; mvy += dx * w; }
        }
      }
      // separation (cheap: same-cell neighbours only)
      const cell = this.grid.cellAt(e.x, e.y);
      if (cell && cell.length > 1) {
        let checks = 0;
        for (let k = 0; k < cell.length && checks < 5; k++) {
          const o = cell[(k + i) % cell.length];
          if (o === e || o.inert) continue;
          checks++;
          const ox = e.x - o.x, oy = e.y - o.y, rr = (e.r + o.r) * 0.85, d2 = ox * ox + oy * oy;
          if (d2 < rr * rr && d2 > 0.01) {
            const d = Math.sqrt(d2), push = ((rr - d) / d) * (e.boss ? 0.5 : 6);
            mvx += ox * push; mvy += oy * push;
          }
        }
      }
      e.kx *= kd; e.ky *= kd;
      e.x += (mvx + e.kx) * dt; e.y += (mvy + e.ky) * dt;

      // contact damage
      const cdx = P.x - e.x, cdy = P.y - 10 - e.y, cr = e.r + P.r;
      if (cdx * cdx + cdy * cdy < cr * cr && e.freezeT <= 0 && e.dmg > contactDmg) { contactDmg = e.dmg; contactSrc = e.type + (e.elite ? '*' : ''); contactBoss = e.boss || e.elite ? e : null; }

      // visuals
      e.anim += dt * (e.d.anim || 4);
      const fr = (e.anim | 0) & 1;
      p.texture = e.flash > 0 ? e.d._w[fr] : e.d._t[fr];
      if (e.flash > 0) e.flash -= dt;
      p.x = e.x; p.y = e.y;
      const face = (e.rush ? e.rush.x : dx) < 0 ? -1 : 1;
      const squash = 1 + Math.sin(e.anim * 1.6 + e.phase) * 0.05;
      p.scaleX = e.scale * face * (2 - squash);
      p.scaleY = e.scale * squash;
      if (e.d.alpha) p.alpha = e.d.alpha * (0.75 + Math.sin(e.t * 5 + e.phase) * 0.25);
      if (e.glow) { e.glow.x = e.x; e.glow.y = e.y; e.glow.alpha = 0.45 + Math.sin(e.t * 4) * 0.15; }
    }
    if (contactDmg > 0 && P.iframes <= 0) {
      this.hurtPlayer(contactDmg, 'touch:' + contactSrc);
      if (contactBoss) {
        // bosses shove you clear instead of juggling you to death
        const bx = P.x - contactBoss.x, by = P.y - contactBoss.y, bl = Math.hypot(bx, by) || 1;
        const big = contactBoss.boss;
        P.x += (bx / bl) * (big ? 70 : 45); P.y += (by / bl) * (big ? 70 : 45);
        P.iframes = Math.max(P.iframes, big ? 1.1 : 0.8);
        this.shockwave(P.x, P.y, 0xff3a6a, 120, 0.3);
      }
    }
  }

  bossAI(e, dt, dx, dy, dist) {
    e.stT -= dt;
    if (e.stT > 0) return;
    this._shotSrc = 'shot:' + e.type;
    if (e.d.summon) {
      e.stT = 4;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        const c = this.spawnEnemy(e.d.summon, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, { force: true });
        if (c) { c.kx = Math.cos(a) * 300; c.ky = Math.sin(a) * 300; }
      }
      this.shockwave(e.x, e.y, 0xd070ff, 200, 0.4);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        this.enemyShot(e.x, e.y, Math.cos(a) * 140, Math.sin(a) * 140, e.dmg * 0.35);
      }
    } else if (e.d.slam) {
      e.stT = 4.5;
      this.shake = Math.max(this.shake, 14);
      this.shockwave(e.x, e.y, 0xff7020, 360, 0.6);
      this.burst(e.x, e.y, 30, [0xff7020, 0x5a4a50], 400, 1, 'shard');
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * TAU;
        this.enemyShot(e.x, e.y, Math.cos(a) * 200, Math.sin(a) * 200, e.dmg * 0.5);
      }
      if (dist < 200) this.hurtPlayer(e.dmg, 'slam');
    } else if (e.d.nova) {
      e.stT = 3;
      e.spiral = (e.spiral || 0) + 0.4;
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * TAU + e.spiral;
        this.enemyShot(e.x, e.y, Math.cos(a) * 190, Math.sin(a) * 190, e.dmg * 0.45);
      }
      this.shockwave(e.x, e.y, 0xff3a6a, 300, 0.5);
      this._shotSrc = null;
      if (Math.random() < 0.5) for (let k = 0; k < 3; k++) {
        const sp = this.spawnPointOffscreen();
        this.spawnEnemy('sentinel', sp.x, sp.y, { force: true });
      }
    }
  }

  enemyShot(x, y, vx, vy, dmg) {
    if (this.enemyShots.length > 400) return;
    const p = this.L.projAdd.add(T.orb, x, y);
    p.scaleX = p.scaleY = 1.3;
    this.enemyShots.push({ x, y, vx, vy, dmg, life: 6, p, src: this._shotSrc || 'shot' });
  }
  updateEnemyShots(dt) {
    const P = this.player, s = this.enemyShots;
    for (let i = s.length - 1; i >= 0; i--) {
      const b = s[i];
      b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
      b.p.x = b.x; b.p.y = b.y; b.p.rotation += dt * 5;
      const dx = P.x - b.x, dy = P.y - 12 - b.y;
      let dead = b.life <= 0;
      if (!dead && dx * dx + dy * dy < 18 * 18) { this.hurtPlayer(b.dmg, b.src); dead = true; }
      if (dead) { this.L.projAdd.kill(b.p); s[i] = s[s.length - 1]; s.pop(); }
    }
  }

  // Far-off gems condense into one rich gem so the field stays readable and fast.
  consolidateGems() {
    const P = this.player, fx = this.halfW * 1.6, fy = this.halfH * 1.6;
    let sink = null, sum = 0;
    for (const g of this.pickups) {
      if (!g.alive || g.type !== 'gem' || g.attract) continue;
      if (Math.abs(g.x - P.x) < fx && Math.abs(g.y - P.y) < fy) continue;
      if (!sink) { sink = g; continue; }
      sum += g.value;
      g.alive = false; this.L.pickups.kill(g.p); this.gemCount--;
      if (this.vault === g) this.vault = null;
    }
    if (sink && sum) { sink.value += sum; this.setGemTex(sink); }
  }

  updatePickups(dt) {
    this.gemT = (this.gemT || 0) - dt;
    if (this.gemT <= 0) { this.gemT = 1; if (this.gemCount > 120) this.consolidateGems(); }
    const P = this.player, mag = this.stats.magnet, mag2 = mag * mag;
    const pk = this.pickups;
    for (let i = pk.length - 1; i >= 0; i--) {
      const g = pk[i];
      if (!g.alive) { pk[i] = pk[pk.length - 1]; pk.pop(); continue; }
      g.t += dt;
      if (g.pop > 0) {
        g.pop -= dt; g.x += g.vx * dt; g.y += g.vy * dt; g.vy += 400 * dt;
      }
      const dx = P.x - g.x, dy = P.y - 12 - g.y, d2 = dx * dx + dy * dy;
      const magnetic = g.type === 'gem' || g.type === 'cinder';
      if (!g.attract && magnetic && d2 < mag2) g.attract = true;
      if (g.attract && !this.dead) {
        const d = Math.sqrt(d2) || 1;
        const sp = 300 + g.t * 60 + (g.attractT = (g.attractT || 0) + dt) * 900;
        g.x += (dx / d) * sp * dt; g.y += (dy / d) * sp * dt;
      }
      const cr = g.type === 'chest' ? 34 : 20;
      if (d2 < cr * cr && !this.dead) { this.collect(g); continue; }
      const p = g.p;
      p.x = g.x;
      p.y = g.y + (g.type === 'gem' ? Math.sin(g.t * 4 + g.x) * 2 : Math.sin(g.t * 3) * 3);
      if (g.type === 'chest' && Math.random() < dt * 6) this.spawnFx(T.spark, g.x + rand(-18, 18), g.y + rand(-20, 6), { life: 0.6, s0: 0.5, s1: 0, tint: 0xffd060, vy: -40 });
    }
  }

  updateFx(dt) {
    const fx = this.fx;
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) { f.layer.kill(f.p); f.p = null; this.fxPool.push(f); fx[i] = fx[fx.length - 1]; fx.pop(); continue; }
      const k = Math.exp(-f.drag * dt);
      f.vx *= k; f.vy = f.vy * k + f.grav * dt;
      const p = f.p;
      p.x += f.vx * dt; p.y += f.vy * dt;
      const t = f.life / f.max;
      const s = f.s1 + (f.s0 - f.s1) * t;
      p.scaleY = s; p.scaleX = f.sx || s;
      p.alpha = f.a0 * Math.min(1, t * 1.5);
      if (f.spin) p.rotation += f.spin * dt;
    }
    const nums = this.numbers;
    for (let i = nums.length - 1; i >= 0; i--) {
      const n = nums[i];
      n.life -= dt;
      if (n.life <= 0) { for (const p of n.parts) this.L.nums.kill(p); this.numPool.push(n); nums[i] = nums[nums.length - 1]; nums.pop(); continue; }
      n.y += n.vy * dt; n.vy *= Math.exp(-4 * dt);
      const pop = n.life > 0.6 ? 1 + (n.life - 0.6) * 6 : 1;
      const a = Math.min(1, n.life * 3);
      for (let k = 0; k < n.parts.length; k++) {
        const p = n.parts[k];
        p.y = n.y; p.alpha = a; p.scaleX = p.scaleY = n.sc * pop;
        p.x = n.x + (k - (n.parts.length - 1) / 2) * n.w * pop;
      }
    }
  }

  // procedural decor, chunked around the player
  updateDecor() {
    const C = 480, P = this.player;
    const cx0 = Math.floor((P.x - this.halfW - 100) / C), cx1 = Math.floor((P.x + this.halfW + 100) / C);
    const cy0 = Math.floor((P.y - this.halfH - 100) / C), cy1 = Math.floor((P.y + this.halfH + 100) / C);
    const want = new Set();
    for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
      const k = cx + ',' + cy;
      want.add(k);
      if (this.chunks.has(k)) continue;
      let s = (cx * 73856093) ^ (cy * 19349663) ^ 0x5bd1e995;
      const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      const ps = [];
      const n = 5 + ((r() * 7) | 0);
      for (let i = 0; i < n; i++) {
        const v = r();
        const name = v < 0.25 ? 'grass' : v < 0.42 ? 'rock1' : v < 0.55 ? 'rock0' : v < 0.68 ? 'flower' : v < 0.8 ? 'shroom' : v < 0.92 ? 'bones' : 'pillar';
        const p = this.L.decor.add(T[name], cx * C + r() * C, cy * C + r() * C);
        p.anchorY = 0.85;
        if (r() < 0.5) p.scaleX = -1;
        p.alpha = 0.85;
        ps.push(p);
      }
      this.chunks.set(k, ps);
    }
    for (const [k, ps] of this.chunks) {
      if (want.has(k)) continue;
      for (const p of ps) this.L.decor.kill(p);
      this.chunks.delete(k);
    }
  }

  // ---------- render ----------
  render(rawDt) {
    const P = this.player, z = this.zoom, sw = this.app.screen.width, sh = this.app.screen.height;
    let sx = 0, sy = 0;
    if (this.shake > 0 && save.settings.shake) {
      sx = rand(-1, 1) * this.shake; sy = rand(-1, 1) * this.shake;
    }
    this.shake = Math.max(0, this.shake - rawDt * 60);
    this.world.scale.set(z);
    this.world.position.set(Math.round(sw / 2 - P.x * z + sx), Math.round(sh / 2 - P.y * z + sy));
    this.ground.tileScale.set(z);
    this.ground.tilePosition.set(this.world.position.x, this.world.position.y);

    // player
    const ps = this.playerSprite;
    P.bob += rawDt * (P.moving ? 14 : 3);
    ps.x = P.x; ps.y = P.y + (P.moving ? -Math.abs(Math.sin(P.bob)) * 3 : 0);
    const step = P.moving ? Math.sin(P.bob) : 0;
    ps.texture = T[this.char.sprite + (step > 0.35 ? '_s1' : step < -0.35 ? '_s2' : '')];
    if (P.fx !== 0) ps.scale.x = P.fx < 0 ? -1 : 1;
    ps.scale.y = 1 + Math.sin(P.bob * 0.5) * (P.moving ? 0 : 0.02);
    ps.tint = P.hurtT > 0 ? 0xff6060 : this.buffs.bloodrage > 0 ? 0xff9090 : 0xffffff;
    ps.alpha = P.iframes > 0 && Math.floor(this.time * 20) % 2 ? 0.6 : (this.buffs.invuln > 0 ? 0.55 : 1);
    const kt = this.kindleTier;
    this.playerGlow.x = P.x; this.playerGlow.y = P.y - 14;
    this.playerGlow.scale.set(2.2 + kt * 0.45 + Math.sin(this.time * 6) * 0.08);
    this.playerGlow.tint = this.buffs.bloodrage > 0 ? 0xff3040 : this.buffs.overclock > 0 ? 0x60ffc0 : this.buffs.shatter > 0 ? 0x80e0ff : kt >= 4 ? 0xffe090 : 0xff9a40;
    this.playerGlow.alpha = 0.32 + kt * 0.06;
    if (kt >= 2 && Math.random() < rawDt * kt * 8) {
      this.spawnFx(T.dot, P.x + rand(-14, 14), P.y - rand(0, 30), { life: 0.7, s0: rand(0.6, 1.2), s1: 0, vy: -rand(40, 90), tint: kt >= 4 ? 0xffe080 : 0xff8030, a: 0.9, drag: 0.5 });
    }
    // hp bar
    const hb = this.hpBar;
    hb.clear();
    if (!this.dead) {
      const r = Math.max(0, P.hp / this.stats.maxHp);
      hb.rect(P.x - 18, P.y + 8, 36, 5).fill({ color: 0x120814, alpha: 0.85 });
      hb.rect(P.x - 17, P.y + 9, 34 * r, 3).fill(r > 0.5 ? 0x5aff8a : r > 0.25 ? 0xffd040 : 0xff4050);
    }

    this.drawIndicators(sw, sh);

    // screen overlays
    this.hurtFlash = Math.max(0, (this.hurtFlash || 0) - rawDt * 2);
    const low = 1 - P.hp / this.stats.maxHp;
    this.hurtVignette.alpha = Math.max(this.hurtFlash, low > 0.6 ? (low - 0.6) * 1.5 * (0.7 + Math.sin(this.time * 6) * 0.3) : 0);
    this.flashAlpha = Math.max(0, this.flashAlpha - rawDt * 2.2);
    this.flashG.clear();
    if (this.flashAlpha > 0.01) this.flashG.rect(0, 0, sw, sh).fill({ color: this.flashColor, alpha: this.flashAlpha * 0.6 });

    for (const k in this.L) this.L[k].flush();
    this.ui.updateHUD(this);
  }

  // edge arrows pointing at off-screen chests and bosses
  drawIndicators(sw, sh) {
    const g = this.indicators, P = this.player, z = this.zoom;
    g.clear();
    const mark = (x, y, color, size) => {
      if (this.inView(x, y, -10)) return;
      const dx = (x - P.x) * z, dy = (y - P.y) * z;
      const m = 34, hw = sw / 2 - m, hh = sh / 2 - m;
      const k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
      const ex = sw / 2 + dx * k, ey = sh / 2 + dy * k, a = Math.atan2(dy, dx);
      const pulse = 1 + Math.sin(this.time * 8) * 0.12;
      const s = size * pulse, c = Math.cos(a), si = Math.sin(a);
      g.poly([ex + c * s * 1.4, ey + si * s * 1.4, ex - c * s * 0.6 - si * s, ey - si * s * 0.6 + c * s,
        ex - c * s * 0.6 + si * s, ey - si * s * 0.6 - c * s]).fill({ color, alpha: 0.9 }).stroke({ color: 0x000000, width: 2, alpha: 0.6 });
    };
    for (const pk of this.pickups) if (pk.alive && pk.type === 'chest') mark(pk.x, pk.y, 0xffcf4a, 10);
    if (this.boss && this.boss.alive) mark(this.boss.x, this.boss.y, 0xff3a6a, 14);
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}

// ---------- utils ----------
const ENEMY_COLORS = {
  gloomling: 0x8a5ad0, moth: 0xff8ad0, husk: 0xff7a30, wraith: 0x70e0d0, splitter: 0x9ad04a, broodling: 0x9ad04a,
  beetle: 0xff5a6a, spitter: 0x4ad8b0, sentinel: 0xff4a8a, matron: 0xd070ff, colossus: 0xff8030, tyrant: 0xffd060,
};
function bossName(t) { return { matron: 'THE BROOD MATRON', colossus: 'THE CINDER COLOSSUS', tyrant: 'THE ECLIPSE TYRANT' }[t] || t.toUpperCase(); }
function kindleTierOf(c) { let t = 0; for (let i = 0; i < KINDLE_TIERS.length; i++) if (c >= KINDLE_TIERS[i].at) t = i; return t; }
function weighted(pairs) {
  let tot = 0; for (const [, w] of pairs) tot += w;
  let r = Math.random() * tot;
  for (const [k, w] of pairs) { r -= w; if (r <= 0) return k; }
  return pairs[0][0];
}
function weightedObj(o) {
  let tot = 0; for (const k in o) tot += o[k];
  let r = Math.random() * tot;
  for (const k in o) { r -= o[k]; if (r <= 0) return k; }
  return Object.keys(o)[0];
}
function describeDelta(d) {
  const parts = [];
  for (const k in d) {
    const v = d[k];
    if (k === 'amount') parts.push(`+${v} projectile${v > 1 ? 's' : ''}`);
    else if (k === 'dmg') parts.push(`+${v} damage`);
    else if (k === 'pierce') parts.push(`+${v} pierce`);
    else if (k === 'chains') parts.push(`+${v} chain${v > 1 ? 's' : ''}`);
    else if (k === 'area') parts.push(`+${Math.round(v * 100)}% area`);
    else if (k === 'speed') parts.push(`+${Math.round(v * 100)}% speed`);
    else if (k === 'duration') parts.push(`+${v}s duration`);
    else if (k === 'cdMul') parts.push(`-${Math.round((1 - v) * 100)}% cooldown`);
    else if (k === 'freeze') parts.push(`+${Math.round(v * 100)}% freeze chance`);
  }
  return parts.join(' · ');
}
export { rand, TAU };
