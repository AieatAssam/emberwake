// Emberwake core simulation + rendering.
import { Container, ParticleContainer, Particle, Sprite, TilingSprite, Texture, Graphics, Rectangle, ColorMatrixFilter } from 'pixi.js';
import { T, makeGroundCanvas, makeVignetteCanvas, makeEdgeGlowCanvas } from './atlas.js';
import { DIFFICULTY, ETERNAL, KEEPSAKES, hasSeal,
  BASE_STATS, WEAPONS, PASSIVES, PACTS, CHARACTERS, ENEMIES, WAVES, EVENTS, META, FUSIONS, FEATS, STAGES,
  MAX_WEAPON_LEVEL, MAX_WEAPONS, MAX_PASSIVES, xpForLevel, enemyHpScale, midRamp, weaponStatsAt, fusionPartnersOf, HOLLOW_AT } from './data.js';
import { BEHAVIORS } from './weapons.js';
import { sfx, setIntensity, setBoss, setHollow, fadeMusic } from './audio.js';
import { buzz } from './haptics.js';
import { TUNE } from './tuning.js';
import { makeObjective } from './objectives.js';
import { moveVector, consumePressed, padButtons } from './input.js';
import { save, persist } from './save.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
export const KINDLE_TIERS = [
  { at: 0, mul: 1 }, { at: 25, mul: 1.15 }, { at: 70, mul: 1.3 }, { at: 150, mul: 1.5 },
  { at: 300, mul: 1.75 }, { at: 600, mul: 2 }, { at: 1200, mul: 2.5 },
];
// one-time gifts for first reaching a Kindle tier in a run
const KINDLE_REWARDS = { 3: 'flare', 4: 'magnet', 6: 'chest' };
// drifting ambient motes per stage: tint(s), vertical drift, sway, blink, scale
const MOTES = {
  gloam: { tints: [0xb080ff, 0x80a0ff], vy: -8, sway: 12, blink: 0, s: [0.4, 0.8] },
  ashfields: { tints: [0xff7a30, 0xffc060], vy: -38, sway: 16, blink: 9, s: [0.3, 0.6] },
  marsh: { tints: [0xc8ff70], vy: -4, sway: 22, blink: 2, s: [0.4, 0.8] },
  rimewood: { tints: [0xe8f4ff], vy: 24, sway: 18, blink: 0, s: [0.3, 0.6] },
  reliquary: { tints: [0xffd080, 0xc890ff], vy: -14, sway: 10, blink: 5, s: [0.3, 0.6] },
  glassdunes: { tints: [0xffe0a0, 0x70f0e0], vy: 6, sway: 30, blink: 3, s: [0.3, 0.7] },
  wayfarers: { tints: [0xfff0b0, 0xc8e8ff], vy: -6, sway: 26, blink: 2, s: [0.3, 0.6] },
  stormcoast: { tints: [0xc8e8ff, 0xffffff], vy: 8, sway: 40, blink: 4, s: [0.25, 0.55] },
};
const MAX_ENEMIES = 1100;
const MAX_FX = 2600;
const GEM_CAP = 650;
const AFFIXES = ['swift', 'vampiric', 'warded', 'volatile'];
const AFFIX_TINT = { swift: 0x40e0ff, vampiric: 0xff2040, warded: 0x4a7aff, volatile: 0xff8a20 };
const ENEMY_COLORS = {
  herald: 0xb8a8ff,
  gloomling: 0x8a5ad0, moth: 0xff8ad0, husk: 0xff7a30, wraith: 0x70e0d0, splitter: 0x9ad04a, broodling: 0x9ad04a,
  beetle: 0xff5a6a, spitter: 0x4ad8b0, sentinel: 0xff4a8a, matron: 0xd070ff, colossus: 0xff8030, tyrant: 0xffd060,
  imp: 0xff8a30, frostwisp: 0xa8e8ff, lurker: 0x8ad070, scarab: 0x2fd8c8, acolyte: 0xffc060, thief: 0xffd040,
};
// Hearth upgrades that are counted in whole items, not scaled stats
const WHOLE_META = new Set(['amount', 'revival', 'reroll', 'banish', 'spark']);
const CHEST_COL = { bronze: 0xd89050, silver: 0x8ad0ff, gold: 0xffd040, ascend: 0xe070ff };
const chestTierOf = (n) => (n >= 5 ? 'gold' : n >= 3 ? 'silver' : 'bronze');

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
  constructor(app, ui, charId, stageId = 'gloam', opts = {}) {
    this.app = app;
    this.ui = ui;
    this.charId = charId;
    this.char = CHARACTERS[charId];
    this.perk = this.char.perk || '';
    this.stageId = STAGES[stageId] ? stageId : 'gloam';
    this.stage = STAGES[this.stageId];
    // Heat: optional difficulty ladder, unlocked one level per win on this stage
    this.daily = opts.daily || null;
    this.diff = DIFFICULTY[this.daily ? 'normal' : save.settings.difficulty] || DIFFICULTY.normal;
    this.heat = this.daily ? 0 : Math.max(0, Math.min(save.heatSel[this.stageId] || 0, save.heatMax[this.stageId] || 0));

    this.root = new Container();
    app.stage.addChild(this.root);

    const groundTex = Texture.from(makeGroundCanvas(this.stage.ground));
    groundTex.source.addressMode = 'repeat';
    this.ground = new TilingSprite({ texture: groundTex, width: app.screen.width, height: app.screen.height });
    this.ground.tint = this.stage.tint;
    this.root.addChild(this.ground);

    this.world = new Container();
    this.root.addChild(this.world);
    this.L = {
      decor: new Layer(this.world),
      glowUnder: new Layer(this.world, 'add'),
      pickups: new Layer(this.world),
      enemies: new Layer(this.world),
      motes: new Layer(this.world, 'add'),
    };
    this.initMotes();
    this.shrineG = new Graphics();
    this.world.addChildAt(this.shrineG, this.world.getChildIndex(this.L.pickups.pc));
    this.objG = new Graphics();
    this.world.addChildAt(this.objG, this.world.getChildIndex(this.L.pickups.pc));
    this.obj = makeObjective(this);
    this.zoneG = new Graphics();
    this.world.addChildAt(this.zoneG, this.world.getChildIndex(this.L.pickups.pc));
    this.stillT = 0; this.stillSev = 0; this.posLog = []; this.posLogT = 0; this.settleWarned = false;
    this.zones = []; this.obstacles = new Map(); this.meteorT = 0; this.perkT = 0;
    this.biomeT = 0; this.curBiome = 0; this.wind = null; this.windT = this.stage.wind ? 18 : 0;
    this.shrine = null; this.shrineT = 150;
    this.playerGlow = new Sprite(T.softglow);
    this.playerGlow.anchor.set(0.5);
    this.playerGlow.blendMode = 'add';
    this.world.addChild(this.playerGlow);
    this.playerSprite = new Sprite(T[this.char.sprite]);
    // Dawn variant: cosmetic golden hue for Bearers who have broken the Eclipse
    if (save.skins[charId] === 'dawn') {
      const cm = new ColorMatrixFilter();
      cm.sepia(false); cm.saturate(0.35, true); cm.brightness(1.22, true);
      this.playerSprite.filters = [cm];
    }
    this.playerSprite.anchor.set(0.5, 0.88);
    this.world.addChild(this.playerSprite);
    this.hpBar = new Graphics();
    this.world.addChild(this.hpBar);
    this.L.proj = new Layer(this.world);
    this.L.projAdd = new Layer(this.world, 'add');
    this.L.fx = new Layer(this.world);
    this.L.fxAdd = new Layer(this.world, 'add');
    // the Bearer and health bar render above all effects so they never vanish in the spectacle
    this.world.addChild(this.playerSprite);
    this.world.addChild(this.hpBar);
    this.L.nums = new Layer(this.world);

    this.vignette = new Sprite(Texture.from(makeVignetteCanvas()));
    this.root.addChild(this.vignette);
    const edgeTex = Texture.from(makeEdgeGlowCanvas());
    this.hurtVignette = new Sprite(edgeTex);
    this.hurtVignette.tint = 0xff0020; this.hurtVignette.alpha = 0; this.hurtVignette.blendMode = 'add';
    this.root.addChild(this.hurtVignette);
    // Kindle glow: screen edges warm as the kill streak climbs
    this.kindleGlow = new Sprite(edgeTex);
    this.kindleGlow.tint = 0xff7a20; this.kindleGlow.alpha = 0; this.kindleGlow.blendMode = 'add';
    this.root.addChildAt(this.kindleGlow, this.root.getChildIndex(this.hurtVignette));
    this.indicators = new Graphics();
    this.root.addChild(this.indicators);
    this.flashG = new Graphics();
    this.root.addChild(this.flashG);
    this.flashAlpha = 0; this.flashColor = 0xffffff;

    this.grid = new Grid(64);
    this.qa = []; this.qb = []; this.qExp = []; this.qNova = []; this.qZone = [];
    this.fxPool = []; this.projPool = []; this.numPool = []; this.enemyPool = [];

    // state
    this.time = 0; this.kills = 0; this.level = 1; this.xp = 0; this.xpNext = xpForLevel(1);
    this.cinders = 0; this.pendingLevels = 0;
    this.enemies = []; this.projectiles = []; this.enemyShots = []; this.fx = []; this.pickups = []; this.numbers = [];
    this.weapons = []; this.passives = {}; this.pacts = []; this.banished = new Set();
    this.combo = 0; this.comboT = 0; this.kindleTier = 0; this.bestCombo = 0;
    this.flare = 0; this.buffs = { overclock: 0, bloodrage: 0, shatter: 0, invuln: 0, bloodMoon: 0, deadeye: 0, lantern: 0 };
    this.rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.hitStop = 0; this.hitStopCd = 0; this.hitFxBudget = 0; this.kindleRewarded = {}; this.nextStreak = 250;
    this.shake = 0; this.timeScale = 1; this.slowT = 0;
    this.waveIdx = 0; this.eventIdx = 0; this.spawnAcc = 0; this.totemT = 0; this.eliteT = 0;
    this.boss = null; this.victory = false; this.endless = false; this.dead = false;
    this.paused = false;
    this.chunks = new Map();
    this.chestQueue = [];
    this.pressure = 1;
    this.hollowAt = HOLLOW_AT; this.hollowN = 0; this.hollowWarned = false;
    this.maxFx = this.baseFx = save.settings.lowfx ? Math.round(MAX_FX / 2) : MAX_FX;
    this.frameAvg = 1 / 60; this.qualT = 0;
    this.bossKills = {};
    this.seenRun = {};
    this.featsEarned = [];
    this.featT = 0;
    this.prof = { weapons: 0, proj: 0, enemies: 0, fx: 0, pickups: 0, grid: 0 };
    this.weaponUid = 0;

    this.player = { x: 0, y: 0, hp: 100, iframes: 0, chillT: 0, fx: 1, fy: 0, moving: false, bob: 0, hurtT: 0, r: 14 };
    this.recalcStats();
    this.player.hp = this.stats.maxHp;
    this.rerolls = this.stats.rerolls; this.banishes = this.stats.banishes;
    this.addWeapon(this.char.weapon);
    // some Bearers start with their signature weapon already trained
    for (let i = 1; i < (this.char.startLevel || 1); i++) this.levelWeapon(this.char.weapon);
    // Hearth: Second Spark grants random starting relics
    for (let i = 0; i < (save.meta.spark || 0); i++) {
      const pool = Object.keys(PASSIVES).filter((k) => !this.passives[k]);
      if (pool.length) this.addPassive(pool[(Math.random() * pool.length) | 0]);
    }
    if (save.meta.spark) this.player.hp = this.stats.maxHp;
    if (this.daily) {
      this.addWeapon(this.daily.weapon);
      this.pacts.push(...this.daily.pacts);
      this.recalcStats();
      this.player.hp = this.stats.maxHp;
    }
    this.zoom = 1;
    this.resize();
  }

  // ---------- stats ----------
  recalcStats() {
    const s = { ...BASE_STATS };
    for (const k in META) { const l = save.meta[k] || 0; if (l) META[k].apply(s, WHOLE_META.has(k) ? l : l * TUNE.metaPower); }
    if (!this.daily && save.keepsakeSel && KEEPSAKES[save.keepsakeSel] && hasSeal(save, save.keepsakeSel, 'dawn')) KEEPSAKES[save.keepsakeSel].apply(s);
    for (const k in ETERNAL) { const l = save.eternal[k] || 0; if (l) ETERNAL[k].apply(s, l); }
    this.char.apply(s);
    for (const k in this.passives) PASSIVES[k].apply(s, this.passives[k]);
    for (const p of this.pacts) PACTS[p].apply(s);
    if (this.perk === 'debtor') s.might += 0.07 * this.pacts.length;
    s.greed *= this.stage.greedMul; // stage hp/speed ramp in per spawn (see spawnEnemy)
    s.greed *= this.diff.cinders; s.growth *= this.diff.xp;
    if (this.heat) s.greed *= 1 + 0.3 * this.heat; // heat's enemy buffs ramp in per spawn (see spawnEnemy/director)
    if (s.overcharge) { /* not used */ }
    // Heat dampens Overcharge so higher Heat stays tense after the build snowballs
    const oc = (this.overcharge || 0) / (1 + 0.15 * (this.heat || 0));
    s.might += oc * 0.08 * TUNE.overcharge; s.cooldown *= Math.pow(0.97, oc); s.area += oc * 0.03; s.maxHp += oc * 5;
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
    o.dmg = b.dmg * might * TUNE.playerDmg * (1 + 0.15 * (b.amount == null ? s.amount : 0));
    o.cd = b.cd * cdm;
    o.amount = b.amount != null ? b.amount + s.amount : 0;
    o.area = (b.area || 1) * s.area * (1 + 0.1 * (b.amount == null ? s.amount : 0));
    o.speed = (b.speed || 1) * s.projSpeed * (B.deadeye > 0 ? 1.5 : 1);
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
    if (this.time > 100 && this.pacts.length < (this.perk === 'debtor' ? 4 : 3) && Math.random() < 0.09 * this.stats.luck) {
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
      const desc = w ? describeDelta(def.levels[w.level - 1]) : def.desc;
      const hint = fusionPartnersOf(p.id).map((fp) => {
        const has = this.weapons.find((x) => x.id === fp.partner);
        return `Fuses with ${WEAPONS[fp.partner].name}${has ? ' ✓' : ''} → ${save.fusions[fp.fusion] ? FUSIONS[fp.fusion].name : '???'}`;
      }).join(' · or · ');
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
  chestCount(minItems = 1) {
    const L = this.stats.luck * TUNE.chestBig, r = Math.random();
    let n = 1;
    if (r < 0.05 * L) n = 5; else if (r < 0.22 * L) n = 3;
    return Math.max(n, minItems);
  }
  rollChest(minItems = 1, fixed = false) {
    const n = fixed ? minItems : this.chestCount(minItems);
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
    this.chestsOpened = (this.chestsOpened || 0) + 1; this.chestItems = (this.chestItems || 0) + res.items.length;
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
    this.kindleGlow.width = w; this.kindleGlow.height = h;
    this.halfW = w / this.zoom / 2; this.halfH = h / this.zoom / 2;
  }
  inView(x, y, m = 0) {
    return Math.abs(x - this.player.x) < this.halfW + m && Math.abs(y - this.player.y) < this.halfH + m;
  }
  flash(color, a) {
    if (save.settings.lowfx) return; // no full-screen flashes in reduced-effects mode
    this.flashColor = color; this.flashAlpha = Math.max(this.flashAlpha, a);
  }

  enemiesIn(x, y, r, out) { out.length = 0; return this.grid.query(x, y, r, out); }

  nearestEnemy(x, y, maxR = 99999, skip = null) {
    let best = null, bd = maxR * maxR;
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (!e.alive || e.inert || e.d.hollow || e === skip) continue;
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
      if (e.alive && !e.inert && !e.d.hollow && this.inView(e.x, e.y, -20)) return e;
    }
    return this.nearestEnemy(this.player.x, this.player.y, 900);
  }

  // ---------- FX ----------
  spawnFx(tex, x, y, o) {
    if (this.fx.length >= this.maxFx) return null;
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
  dmgNumber(x, y, val, crit, tint = 0xffffff) {
    if (!save.settings.numbers || this.numbers.length > 120 || (this.pressure > 2 && !crit)) return;
    const str = String(Math.max(1, Math.round(val))) + (crit ? '!' : '');
    const sc = crit ? 0.8 : 0.55;
    const n = this.numPool.pop() || { parts: [] };
    const parts = n.parts;
    parts.length = 0;
    const w = 11 * sc * 1.4;
    for (let i = 0; i < str.length; i++) {
      const p = this.L.nums.add(T['d' + str[i]], x + (i - (str.length - 1) / 2) * w, y);
      p.scaleX = p.scaleY = sc;
      p.tint = crit ? 0xffd040 : tint;
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
    if (d.boss) hp = d.hp * (0.45 + this.level * 0.036) * this.stats.enemyHp * TUNE.enemyHp * TUNE.bossHp * (this.endless ? enemyHpScale(this.time) / 5 : 1);
    // stage difficulty ramps in over the first 3 minutes so every stage has a fair opening
    const ramp = Math.min(1, this.time / (180 + 30 * (this.heat || 0)));
    const h = (this.heat || 0) * ramp;
    // heat keeps biting as the run goes on: +3% enemy HP per heat level per minute on top of the flat bonus
    const heatHp = (1 + 0.25 * h + 0.03 * (this.heat || 0) * (this.time / 60)) * this.diff.hp;
    const stHp = (1 + (this.stage.hpMul - 1) * ramp) * (1 + (this.stage.lateHp || 0) * (this.time / 60)) * heatHp, stSpd = (1 + (this.stage.speedMul - 1) * ramp) * (1 + 0.04 * h) * this.diff.speed * TUNE.enemySpeed;
    if (d.boss) hp *= stHp * (1 + 0.3 * (this.heat || 0));
    else if (!d.inert) hp = d.hp * enemyHpScale(this.time) * this.stats.enemyHp * TUNE.enemyHp * stHp * (elite ? 14 : 1);
    const scale = (elite ? 1.55 : 1) * (o.scale || 1);
    // pooled: enemies die by the hundreds per second late-game, so avoid churning objects
    const e = this.enemyPool.pop() || {};
    e.type = type; e.d = d; e.x = x; e.y = y; e.kx = 0; e.ky = 0; e.hp = hp; e.maxHp = hp; e.alive = true; e.uid = uidCounter++;
    e.speed = d.speed * (elite ? 0.9 : 1) * rand(0.92, 1.08) * stSpd;
    e.dmg = (d.boss ? d.dmg : d.dmg * (elite ? 1.3 : 1) * (1 + this.time / 900) * this.stats.enemyDmg) * this.diff.dmg * TUNE.enemyDmg * (1 + TUNE.dmgMid * midRamp(this.time));
    e.r = d.r * scale; e.scale = scale; e.xp = d.xp * (elite ? 10 : 1); e.elite = elite; e.boss = !!d.boss; e.inert = !!d.inert;
    e.flash = 0; e.slowT = 0; e.freezeT = 0; e.anim = Math.random() * 10; e.frame = 0; e.t = 0; e.state = 0;
    e.stT = d.blink ? 1 : d.boss ? 3.5 : rand(1, 3); e.lastBlink = -99; e.dirX = 0; e.dirY = 0; e.rush = o.rush || null; e.life = o.life || 0;
    e.phase = Math.random() * TAU; e._q = 0; e.glow = null; e.spiral = 0; e.charging = 0; e.affix = null; e.sunk = false;
    e.p = this.L.enemies.add(d._t[0], x, y);
    e.p.anchorY = 0.62;
    e.p.scaleX = e.p.scaleY = scale;
    if (d.alpha) e.p.alpha = d.alpha;
    // from 3:00, elites roll an affix that changes how they must be fought
    if (elite && this.time > 180) {
      e.affix = AFFIXES[(Math.random() * AFFIXES.length) | 0];
      if (e.affix === 'swift') e.speed *= 1.5;
    }
    if (elite || e.boss) {
      e.glow = this.L.glowUnder.add(T.softglow, x, y);
      e.glow.tint = e.boss ? 0xff4060 : AFFIX_TINT[e.affix] || 0xffc040;
      e.glow.scaleX = e.glow.scaleY = (e.r * 3.2) / 64;
      e.glow.alpha = 0.6;
    }
    e.p.tint = elite ? 0xffe0a0 : d.tint || 0xffffff;
    this.enemies.push(e);
    if (!d.inert) this.seenRun[type] = true;
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
    if (!e.alive || e.d.hollow) return 0;
    let dmg = amount * rand(0.92, 1.08) * (e.affix === 'warded' ? 0.6 : 1) * (e.sunk ? 0.5 : 1) * (e.d.shroud && this.time - e.lastBlink > 1.5 ? 0.25 : 1);
    let crit = false;
    if (this.perk === 'markedprey' && (e.elite || e.boss)) dmg *= 1.35;
    if (this.perk === 'stride' && this.player.moving) dmg *= 1.12;
    // the Eclipse Tyrant is warded until the stage objective is done
    if (e.d.final && !this.obj.done) dmg *= 0.1;
    if (this.buffs.deadeye > 0 || Math.random() < this.stats.crit + (this.stats.luck - 1) * 0.1) { dmg *= this.stats.critMul; crit = true; }
    if (this.buffs.shatter > 0 && e.freezeT > 0) dmg *= 2;
    e.hp -= dmg;
    if (e.d.final && !this.obj.done && e.hp < 1) e.hp = 1;
    e.flash = 0.08;
    if (o) {
      if (o.w) o.w.dmgDone += dmg;
      if (o.knock && !e.boss) {
        const dx = e.x - (o.fx ?? this.player.x), dy = e.y - (o.fy ?? this.player.y);
        const dl = Math.hypot(dx, dy) || 1;
        const k = o.knock * 14 * (1 - (e.d.knockRes || 0)) * (e.elite ? 0.3 : 1);
        e.kx += (dx / dl) * k; e.ky += (dy / dl) * k;
      }
      if (o.freeze && Math.random() < o.freeze && !e.boss) e.freezeT = Math.max(e.freezeT, 1.5);
      if (o.slow) { e.slowT = Math.max(e.slowT, o.slow); }
    }
    if (this.buffs.bloodrage > 0) this.heal(dmg * 0.004, false);
    if (!e.inert) this.dmgNumber(e.x + rand(-6, 6), e.y - e.r - 6, dmg, crit, o && o.w ? elementTint(o.w.id) : 0xffffff);
    if (crit) sfx.crit(); else sfx.hit();
    // impact sparks (budgeted per frame) and a flick of hit-stop on crits against bosses
    if ((crit || this.hitFxBudget > 0) && !e.inert && this.fx.length < this.maxFx * 0.6) {
      this.hitFxBudget--;
      this.spawnFx(T.spark, e.x + rand(-4, 4), e.y - e.r * 0.6, { life: 0.14, s0: crit ? 1.1 : 0.6, s1: 0.1, rot: Math.random() * TAU, tint: o && o.w ? elementTint(o.w.id) : 0xffe0a0, drag: 0 });
    }
    if (crit && e.boss && this.hitStopCd <= 0 && !this.rm) { this.hitStop = Math.max(this.hitStop, 0.025); this.hitStopCd = 0.3; }
    if (e.hp <= 0) this.killEnemy(e, o && o.w);
    return dmg;
  }

  killEnemy(e, w) {
    this.removeEnemy(e);
    const x = e.x, y = e.y;
    this.obj.onKill(e);
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
    this.combo++; this.comboT = this.perk === 'emberwalk' ? 3.8 : 2.8;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    const nt = kindleTierOf(this.combo);
    if (nt > this.kindleTier) {
      this.kindleTier = nt;
      sfx.kindleUp(nt);
      this.ui.kindlePop(KINDLE_TIERS[nt].mul);
      const rw = KINDLE_REWARDS[nt];
      if (rw && !this.kindleRewarded[nt]) {
        this.kindleRewarded[nt] = true;
        const P = this.player;
        if (rw === 'flare') { this.flare = Math.min(100, this.flare + 25); this.ui.toast('KINDLED: +25% FLARE', 'kindle'); }
        else if (rw === 'magnet') { this.dropPickup('magnet', P.x + 40, P.y, 1); this.ui.toast('KINDLED: A MAGNET FALLS', 'kindle'); }
        else { this.dropPickup('chest', P.x + 40, P.y, 1); this.ui.toast('KINDLED: A CHEST IS SENT', 'kindle'); }
      }
      this.burst(this.player.x, this.player.y, 24, [0xffa030, 0xffe080], 300, 0.8);
    }
    if (this.combo >= this.nextStreak) { sfx.streak(this.kindleTier); this.nextStreak += 250; }
    this.flare = Math.min(100, this.flare + (e.boss ? 35 : e.elite ? 8 : 0.32) * this.stats.flareGain * (this.perk === 'rimeheart' && e.freezeT > 0 ? 2.5 : 1));
    if (this.perk === 'bloodthirst' && !e.boss) this.heal(0.35, false);
    // death fx
    const col = ENEMY_COLORS[e.type] || 0xb080ff;
    const big = e.boss ? 4 : e.elite ? 2 : 1;
    if ((this.fx.length < this.maxFx * 0.8 && this.deathFxBudget-- > 0) || big > 1) {
      // death pop: the creature's white silhouette swells and fades
      const pop = this.spawnFx(e.d._w[(e.anim | 0) & 1], x, y, { life: 0.16, s0: e.scale, s1: e.scale * 1.6, a: 0.85, add: false, drag: 0 });
      if (pop) pop.p.anchorY = 0.62;
      this.burst(x, y, 5 * big, [col, 0xffffff], 160 * big, 0.6, 'shard');
      this.spawnFx(T.glow, x, y, { life: 0.22, s0: 0.5 * big * e.scale, s1: 1.4 * big * e.scale, tint: col, a: 0.8 });
      this.spawnFx(T.smoke, x, y, { life: 0.5, s0: 0.6 * e.scale, s1: 1.3 * e.scale, tint: 0x302040, a: 0.5, add: false, vy: -20 });
    }
    sfx.kill(e.r);
    if (e.d.loot) this.dropPickup('chest', x, y, 1);
    // drops
    if (e.boss) {
      this.bossKills[e.type] = true;
      this.dropPickup('gem', x, y, e.xp);
      for (let i = 0; i < 12; i++) this.dropPickup('cinder', x + rand(-60, 60), y + rand(-60, 60), 5);
      this.dropPickup('chest', x, y, e.d.final ? 5 : 3);
      this.slowT = 1.2;
      this.shake = Math.max(this.shake, 30);
      this.flash(0xffffff, 0.8);
      this.burst(x, y, 120, [0xffd060, 0xff4060, 0xffffff], 700, 1.3);
      this.shockwave(x, y, 0xffffff, 1000, 1);
      sfx.boom(); buzz([60, 40, 120], 0);
      if (!this.rm) this.hitStop = Math.max(this.hitStop, 0.08);
      if (e.d.final && !this.victory) { this.victory = true; this.hollowAt = Math.min(this.hollowAt, this.time + 120); this.hollowWarned = false; setTimeout(() => this.ui.showVictory(this), 1800); }
      return;
    }
    if (e.elite) {
      if (Math.random() < TUNE.eliteChest) this.dropPickup('chest', x, y, 1);
      sfx.eliteKill();
      if (!this.rm) this.hitStop = Math.max(this.hitStop, 0.045);
      this.shockwave(x, y, 0xffd060, 90, 0.3);
      this.slowT = 0.35;
      this.shake = Math.max(this.shake, 10);
      this.burst(x, y, 40, [0xffd060, 0xffffff], 400, 1);
    }
    this.dropPickup('gem', x, y, (e.xp * (this.buffs.bloodMoon > 0 ? 2 : 1)) / this.pressure);
    if (Math.random() < 0.012 * this.stats.luck) {
      const roll = weighted([['cinder', 62], ['heart', this.stats.noHeal ? 0 : 16], ['magnet', 5], ['bomb', 4], ['freeze', 4], ['flareorb', 7]]);
      this.dropPickup(roll, x + rand(-8, 8), y + rand(-8, 8), roll === 'cinder' ? 1 + ((Math.random() * 3) | 0) : 1);
    }
    if (e.affix === 'volatile') {
      this._shotSrc = 'volatile';
      const off = Math.random() * TAU;
      for (let k = 0; k < 10; k++) { const a = off + (k / 10) * TAU; this.enemyShot(x, y, Math.cos(a) * 120, Math.sin(a) * 120, e.dmg * 0.5, T.bolt, 0.9); }
      this._shotSrc = null;
    }
    if (e.d.deathBurst) {
      this._shotSrc = 'imp-ember';
      const off = Math.random() * TAU;
      for (let k = 0; k < 6; k++) { const a = off + (k / 6) * TAU; this.enemyShot(x, y, Math.cos(a) * 95, Math.sin(a) * 95, e.dmg * 0.6, T.bolt, 0.8); }
      this._shotSrc = null;
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
        if (this.vault && this.vault.alive) { this.vault.value += value; this.setGemTex(this.vault); return null; }
      }
    }
    let tex;
    if (type === 'gem') tex = T.gem0;
    else if (type === 'flareorb') tex = T.flareorb;
    else tex = T[type];
    const pk = { type, x, y, value, alive: true, attract: false, vx: rand(-60, 60), vy: rand(-90, -30), t: 0, pop: 0.25 };
    pk.p = this.L.pickups.add(tex, x, y);
    if (type === 'gem') { this.setGemTex(pk); this.gemCount = (this.gemCount || 0) + 1; if (this.gemCount >= GEM_CAP && (!this.vault || !this.vault.alive)) this.vault = pk; }
    if (type === 'chest') {
      pk.pop = 0; pk.n = this.chestCount(value); pk.tier = '';
      pk.p.scaleX = pk.p.scaleY = 1.35;
      pk.beam = this.L.glowUnder.add(T.chestbeam || T.softglow, x, y);
      pk.beam.anchorY = 0.92; pk.beam.scaleX = 1.2; pk.beam.scaleY = 1.5; pk.beam.alpha = 0.5;
      pk.ring = this.L.glowUnder.add(T.chestring || T.softglow, x, y);
      sfx.chestDrop();
    }
    if (type === 'cinder' && value >= 10) pk.p.scaleX = pk.p.scaleY = 1.6;
    this.pickups.push(pk);
    return pk;
  }
  // cheap per-pickup life: coin-flip gems, beating hearts, spinning orbs, rattling chests
  animPickup(g, p, dt) {
    if (g.pop > 0) return;
    if (g.bs === undefined) g.bs = p.scaleX;
    const bs = g.bs, t = g.t;
    switch (g.type) {
      case 'gem': p.scaleX = bs * (0.4 + 0.6 * Math.abs(Math.cos(t * 2.2 + g.x))); break;
      case 'heart': p.scaleX = p.scaleY = bs * (1 + 0.14 * Math.pow(Math.max(0, Math.sin(t * 7)), 6)); break;
      case 'magnet': p.rotation = Math.sin(t * 5) * 0.3; break;
      case 'bomb': p.rotation += dt * 1.5; break;
      case 'freeze': p.rotation += dt * 0.8; break;
      case 'flareorb': p.rotation += dt * 3; p.scaleX = p.scaleY = bs * (1 + 0.1 * Math.sin(t * 9)); break;
      case 'cinder': p.alpha = 0.8 + 0.2 * Math.sin(t * 12 + g.x); break;
      case 'chest': {
        const tier = this.fusionReady ? 'ascend' : chestTierOf(g.n);
        const col = CHEST_COL[tier];
        if (tier !== g.tier) {
          g.tier = tier;
          const tex = T[tier === 'bronze' ? 'chest' : 'chest_' + tier];
          if (tex) p.texture = tex;
          g.beam.tint = col; g.ring.tint = col;
        }
        p.rotation = Math.sin(t * 14) * 0.06 * (Math.sin(t * 1.3) > 0.8 ? 1 : 0);
        p.scaleX = p.scaleY = 1.35 * (1 + 0.05 * Math.sin(t * 4));
        g.beam.x = g.x; g.beam.y = g.y + 12; g.beam.alpha = 0.4 + 0.2 * Math.sin(t * 3);
        const k = (t * 0.7) % 1;
        g.ring.x = g.x; g.ring.y = g.y + 6; g.ring.scaleX = g.ring.scaleY = 0.5 + k * 1.6; g.ring.alpha = (1 - k) * 0.8;
        break;
      }
    }
  }
  initMotes() {
    this.motes = [];
    const cfg = MOTES[this.stageId] || MOTES.gloam;
    if (save.settings.lowfx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < 44; i++) {
      const p = this.L.motes.add(T.dot, 0, 0);
      p.tint = cfg.tints[i % cfg.tints.length];
      this.motes.push({ p, u: Math.random(), v: Math.random(), ph: Math.random() * TAU, sc: rand(cfg.s[0], cfg.s[1]), cfg });
    }
  }
  updateMotes(dt, sw, sh, z) {
    const P = this.player, w = sw / z + 80, h = sh / z + 80;
    for (const m of this.motes) {
      const c = m.cfg;
      m.v += (c.vy / h) * dt; m.u += Math.sin(this.time * 0.6 + m.ph) * (c.sway / w) * dt;
      m.u -= Math.floor(m.u); m.v -= Math.floor(m.v);
      const p = m.p;
      p.x = P.x + (m.u - 0.5) * w; p.y = P.y + (m.v - 0.5) * h;
      p.scaleX = p.scaleY = m.sc;
      const b = c.blink === 0 ? 1 : c.blink > 5 ? 0.5 + 0.5 * Math.sin(this.time * c.blink + m.ph) : Math.pow(Math.max(0, Math.sin(this.time * c.blink + m.ph)), 3);
      p.alpha = 0.45 * b;
    }
  }
  setGemTex(pk) {
    const v = pk.value;
    pk.p.texture = v >= 200 ? T.gem4 : v >= 40 ? T.gem3 : v >= 10 ? T.gem2 : v >= 3 ? T.gem1 : T.gem0;
    pk.p.scaleX = pk.p.scaleY = v >= 200 ? 1.2 : v >= 40 ? 1.1 : 0.9;
    pk.bs = pk.p.scaleX;
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
      case 'sunshard': this.obj.onShard(pk); sfx.pickup(); break;
      case 'chest':
        sfx.pickup();
        this.chestQueue.push(pk.n || pk.value);
        this.L.glowUnder.kill(pk.beam); this.L.glowUnder.kill(pk.ring);
        this.shockwave(pk.x, pk.y, CHEST_COL[pk.tier] || 0xffd040, 160, 0.4);
        break;
    }
  }

  gainXp(v) {
    const mul = this.stats.growth * (1 + (KINDLE_TIERS[this.kindleTier].mul - 1) * 0.5);
    this.xp += v * mul * TUNE.xp;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level);
      this.pendingLevels++;
      if (this.perk === 'hearthheart') this.heal(this.stats.maxHp * 0.2, true);
    }
  }
  // the stage objective is complete: lift the Tyrant's ward if it is already up
  onObjectiveDone() {
    this.ui.toast('OBJECTIVE COMPLETE', 'fusion');
    sfx.ascendReady(); sfx.levelup();
    this.flash(0xffe0a0, 0.6);
    const P = this.player;
    this.shockwave(P.x, P.y, 0xffd060, 600, 0.7);
    this.burst(P.x, P.y, 50, [0xffd060, 0xffffff], 520, 1);
    const b = this.boss;
    if (b && b.alive && b.d.final) { b.freezeT = Math.max(b.freezeT, 2); this.ui.toast('THE WARD SHATTERS', 'boss'); }
  }

  // cinders banked at the end of a run: what you gathered plus a survival bonus
  runReward(win) {
    // survival pay does not depend on how many cinder pickups you scooped; the win bonus is a flat prize
    const bonus = Math.round((Math.floor(this.time / 60) * 8 + this.kills / 150) * this.stats.greed + (win ? 800 * this.stats.greed : 0));
    return { gathered: this.cinders, bonus, total: this.cinders + bonus };
  }
  addCinders(v, useKindle) {
    // fractions carry over so small pickups still add up under a low cinder multiplier
    this.cinderAcc = (this.cinderAcc || 0) + v * TUNE.cinders * this.stats.greed * (useKindle ? KINDLE_TIERS[this.kindleTier].mul : 1);
    const whole = Math.floor(this.cinderAcc);
    this.cinderAcc -= whole;
    this.cinders += whole;
  }
  heal(v, show) {
    const P = this.player;
    if (this.stats.noHeal && show) return;
    const before = P.hp;
    v *= 1 - this.stillSev; // the Gloam smothers healing on anyone standing still
    P.hp = Math.min(this.stats.maxHp, P.hp + v);
    if (show && P.hp > before) {
      sfx.heal();
      this.burst(P.x, P.y - 20, 16, [0x60ff90, 0xc0ffd0], 160, 0.6);
    }
  }

  hurtPlayer(amount, src = '?') {
    const P = this.player;
    if (P.iframes > 0 || this.buffs.invuln > 0 || this.dead) return;
    if (this.perk === 'moonstep' && Math.random() < 0.14) {
      P.iframes = 0.5;
      this.burst(P.x, P.y - 10, 12, [0xc9a0ff, 0xffffff], 220, 0.7);
      this.shockwave(P.x, P.y, 0xc9a0ff, 120, 0.3);
      sfx.blink();
      return;
    }
    (this.dmgLog || (this.dmgLog = {}))[src] = (this.dmgLog[src] || 0) + amount;
    this.lastHitBy = src;
    const s = this.stats;
    const dmg = Math.max(1, amount * 0.25, amount * (1 - Math.min(0.5, s.armor * 0.03)) - s.armor);
    P.hp -= dmg;
    P.iframes = this.perk === 'moonstep' ? 0.95 : 0.55; P.hurtT = 0.25;
    this.shake = Math.max(this.shake, 6);
    this.hurtFlash = 0.5;
    if (!this.rm) this.hitStop = Math.max(this.hitStop, 0.05);
    sfx.hurt(); buzz(30, 120);
    if (P.hp <= 0) this.onZeroHp();
  }

  // out of health: a Second Wick revives you once, otherwise the run ends
  onZeroHp() {
    const P = this.player, s = this.stats;
    if (s.revivals > (this.usedRevivals || 0)) {
      this.usedRevivals = (this.usedRevivals || 0) + 1;
      P.hp = s.maxHp * 0.5; P.iframes = 3;
      this.stillT = 0; this.posLog.length = 0;
      this.flash(0xffa040, 1);
      this.ui.toast('SECOND WICK', 'pickup');
      sfx.revive();
      this.triggerFlare('supernova', true);
    } else this.die();
  }

  // The Gloam settles on anyone who stops running: no build, armor or healing can make idling a strategy.
  // Near-stillness (little ground covered over the last six seconds, so jittering in place does not help)
  // builds up; past a short grace period it bites a share of max health that armor cannot stop, chokes
  // healing, and draws a crowd. Deliberate stand-your-ground moments (shrines, springs, hearths) are exempt.
  updateSettle(dt) {
    const P = this.player;
    if (this.dead) return;
    const inZone = this.obj.exempt || this.zones.some((z) => (z.type === 'spring' || z.type === 'hearth') && Math.hypot(P.x - z.x, P.y - z.y) < z.r);
    const inShrine = this.shrine && Math.hypot(P.x - this.shrine.x, P.y - this.shrine.y) < this.shrine.r;
    this.posLogT -= dt;
    if (this.posLogT <= 0) {
      this.posLogT = 0.5;
      this.posLog.push(P.x, P.y);
      if (this.posLog.length > 24) this.posLog.splice(0, 2); // 12 samples = 6 seconds
    }
    let still = false;
    if (this.posLog.length >= 24) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < this.posLog.length; i += 2) {
        x0 = Math.min(x0, this.posLog[i]); x1 = Math.max(x1, this.posLog[i]);
        y0 = Math.min(y0, this.posLog[i + 1]); y1 = Math.max(y1, this.posLog[i + 1]);
      }
      still = Math.hypot(x1 - x0, y1 - y0) < 220;
    }
    if (inZone || inShrine) { this.stillT = 0; this.posLog.length = 0; }
    else if (still) this.stillT += dt;
    else this.stillT = Math.max(0, this.stillT - dt * 2);
    const sev = Math.max(0, Math.min(1, (this.stillT - TUNE.settleAfter) / 6));
    this.stillSev = sev;
    if (sev > 0) {
      if (!this.settleWarned) { this.settleWarned = true; this.ui.toast('THE GLOAM SETTLES: KEEP MOVING', 'boss'); sfx.bossWarn(); }
      this.smolder(this.stats.maxHp * (TUNE.settleDps + (0.10 - TUNE.settleDps) * sev) * dt);
      this.settleSfxT = (this.settleSfxT || 0) - dt;
      if (this.settleSfxT <= 0) { this.settleSfxT = 1; sfx.hurt(); }
    } else if (this.stillT < 1) this.settleWarned = false;
  }
  smolder(amount) {
    const P = this.player;
    if (this.dead || P.hp <= 0 || this.buffs.invuln > 0) return;
    this.lastHitBy = 'settle';
    (this.dmgLog || (this.dmgLog = {})).settle = ((this.dmgLog || {}).settle || 0) + amount;
    P.hp -= amount;
    this.hurtFlash = Math.max(this.hurtFlash || 0, 0.25 + 0.3 * this.stillSev);
    if (P.hp <= 0) this.onZeroHp();
  }

  die() {
    if (this.dead) return;
    const P = this.player;
    this.dead = true;
    sfx.death(); sfx.deathStinger(); fadeMusic(1.2); buzz([80, 40, 200], 0);
    this.burst(P.x, P.y, 80, [0xff8030, 0xffd080, 0xffffff], 400, 1);
    this.playerSprite.visible = false;
    setTimeout(() => this.ui.showResults(this, false), 1400);
  }

  // ---------- flare (character ultimate) ----------
  triggerFlare(kind = this.char.flare, free = false) {
    if (!free) { if (this.flare < 100) return; this.flare = 0; }
    const P = this.player;
    sfx.flare(kind); buzz([40, 30, 90], 0);
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
      case 'toll': {
        this.flash(0xffd27a, 0.6);
        const dmg = (40 + this.level * 8) * might;
        for (const e of this.enemies) {
          if (!e.alive || e.inert || !this.inView(e.x, e.y, 40)) continue;
          if (!e.boss) e.freezeT = Math.max(e.freezeT, 2);
        }
        // three expanding rings of sound, each striking once
        this.novas = this.novas || [];
        for (let k = 0; k < 3; k++) {
          setTimeout(() => {
            if (this.dead) return;
            this.novas.push({ x: P.x, y: P.y, r: 0, max: 800, dmg: dmg * (1 + k * 0.25), hit: new Set(), t: 0 });
            this.shockwave(P.x, P.y, 0xffc860, 800, 0.8);
            sfx.pulse();
          }, k * 260);
        }
        this.burst(P.x, P.y - 20, 60, [0xffd27a, 0xffffff], 600, 1);
        break;
      }
      case 'deadeye':
        this.flash(0x80ffb0, 0.5);
        this.buffs.deadeye = 6;
        this.shockwave(P.x, P.y, 0x6af0a0, 520, 0.6);
        this.burst(P.x, P.y, 50, [0x6af0a0, 0xffffff], 500, 0.9);
        break;
      case 'lanternroad':
        this.flash(0xffe080, 0.5);
        this.buffs.lantern = 8; this.lanternT = 0;
        this.shockwave(P.x, P.y, 0xffd060, 480, 0.6);
        this.burst(P.x, P.y, 50, [0xffd060, 0xffffff], 450, 0.9);
        break;
      case 'debtcalled': {
        const n = this.pacts.length;
        this.flash(0xc050ff, 0.7);
        this.novas = this.novas || [];
        this.novas.push({ x: P.x, y: P.y, r: 0, max: 700 + n * 80, dmg: (50 + this.level * 10) * might * (1 + n * 0.5), hit: new Set(), t: 0 });
        this.shockwave(P.x, P.y, 0xb040ff, 760, 0.9);
        this.burst(P.x, P.y, 70 + n * 20, [0xc050ff, 0xff4080, 0xffffff], 700, 1.1);
        if (n) this.heal(this.stats.maxHp * 0.08 * n, true);
        break;
      }
      case 'hearthfire':
        this.flash(0xffc060, 0.5);
        this.zones.push({ type: 'hearth', x: P.x, y: P.y, r: 200, t: 8, max: 8, tick: 0, dmg: (14 + this.level * 1.5) * might, color: 0xffb040 });
        this.shockwave(P.x, P.y, 0xffb040, 420, 0.7);
        this.burst(P.x, P.y, 70, [0xffb040, 0xffe080, 0xff6020], 420, 1);
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
    pr.frames = o.frames || null; pr.frameT = 0; pr.frameI = 0;
    if (pr.faceVel) p.rotation = Math.atan2(pr.vy, pr.vx);
    this.projectiles.push(pr);
    return pr;
  }

  explodeAt(x, y, radius, dmg, w, tint = 0xff8030, knock = 12) {
    const list = this.enemiesIn(x, y, radius, this.qExp);
    for (const e of list) this.damage(e, dmg, { w, knock, fx: x, fy: y });
    // big additive glows are fill-rate heavy: only a few per frame (mine/meteor chains stack dozens)
    if (this.explGlowBudget-- > 0) this.spawnFx(T.glow, x, y, { life: 0.3, s0: radius / 40, s1: Math.min(radius / 18, 5), tint, a: 0.9 });
    this.shockwave(x, y, tint, radius, 0.3);
    if (this.fx.length < this.maxFx * 0.7) this.burst(x, y, 8, [tint, 0xffffff], radius * 3, 0.6);
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
      if (pr.frames) {
        pr.frameT += dt;
        if (pr.frameT > 0.07) { pr.frameT = 0; pr.frameI ^= 1; p.texture = pr.frames[pr.frameI]; }
      }
      if (pr.spin) p.rotation += pr.spin * dt;
      else if (pr.faceVel) p.rotation = Math.atan2(pr.vy, pr.vx);
      if (pr.fade) p.alpha = Math.min(1, pr.life / (pr.max * 0.3));
      if (pr.trail) {
        pr.trailT -= dt;
        if (pr.trailT <= 0 && this.fx.length < this.maxFx * 0.75) {
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
    this.hitStopCd -= rawDt;
    if (this.hitStop > 0) { this.hitStop -= rawDt; return; } // brief impact freeze; render still runs
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
      if (P.chillT > 0) P.chillT -= dt;
      const spd = S.moveSpeed * (this.buffs.bloodrage > 0 ? 1.3 : 1) * (this.buffs.lantern > 0 ? 1.4 : 1) * (P.chillT > 0 ? 0.75 : 1);
      const mvr = this.resolveObstacles(mv.x * spd, mv.y * spd, dt);
      P.x += mvr.x * dt; P.y += mvr.y * dt;
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

    this.deathFxBudget = Math.round(18 / this.pressure);
    this.explGlowBudget = 3;
    this.glintBudget = this.fx.length < this.maxFx * 0.5 ? 3 : 0;
    this.hitFxBudget = save.settings.lowfx ? 4 : Math.round(14 / this.pressure);
    // grid
    const pf = this.prof, now = performance.now.bind(performance);
    let t0 = now();
    this.grid.clear();
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) if (es[i].alive && !es[i].d.hollow) this.grid.insert(es[i]);

    let t1 = now(); pf.grid += t1 - t0; t0 = t1;
    if (!this.dead) {
      this.director(dt);
      for (const w of this.weapons) for (const part of w.parts) BEHAVIORS[part.behavior].update(this, part, this.eff(part), dt);
      this.updateShrine(dt);
      this.updateSettle(dt);
      this.obj.update(dt);
      this.updatePerks(dt); this.updateHazards(dt); this.updateZones(dt);
      if (this.stage.biomes) this.updateBiome(dt);
      if (this.stage.wind) this.updateWind(dt);
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
        sfx.overcharge(this.overcharge || 0);
        this.shockwave(P.x, P.y, 0xffd060, 260, 0.35);
        this.ui.toast('OVERCHARGE', 'kindle');
      } else {
        sfx.levelup(); buzz([25, 30, 25], 0);
        this.shockwave(P.x, P.y, 0x80d0ff, 400, 0.5);
        this.burst(P.x, P.y, 40, [0x80d0ff, 0xffffff, 0xffd060], 420, 0.9);
        this.ui.showLevelUp(this, choices);
      }
    } else if (this.chestQueue.length && !this.dead && !this.ui.modalOpen) {
      this.ui.showChest(this, this.rollChest(this.chestQueue.shift(), true));
    }
    this.checkHints();
    // Ascension readiness: flag partner weapons in the HUD and announce once per fusion
    this.fuseCheckT = (this.fuseCheckT || 0) - rawDt;
    if (this.fuseCheckT <= 0) {
      this.fuseCheckT = 0.5;
      const ready = this.availableFusions();
      this.readyParents = ready.flatMap((fid) => FUSIONS[fid].parents);
      this.fusionReady = ready.length > 0;
      this.announced = this.announced || {};
      for (const fid of ready) if (!this.announced[fid]) { this.announced[fid] = true; this.ui.toast('ASCENSION READY: open a chest', 'fusion'); sfx.ascendReady(); }
    }
    this.featT -= rawDt;
    if (this.featT <= 0) { this.featT = 0.5; this.checkFeats(); }
    setIntensity(Math.min(1, this.time / 600 + this.kindleTier * 0.08 + (this.boss ? 0.3 : 0)));
    setBoss(!!this.boss); setHollow(this.hollowN > 0);
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
    const heatSpawn = 1 + 0.1 * (this.heat || 0) * Math.min(1, t / (180 + 30 * (this.heat || 0)));
    const objMul = this.obj.spawnMul();
    rate *= this.stats.curse * heatSpawn * this.diff.spawn * TUNE.spawn * (1 + 1.5 * this.stillSev) * objMul; min *= this.stats.curse * heatSpawn * this.diff.spawn * TUNE.spawn * (1 + 1.5 * this.stillSev) * objMul;
    if (this.boss) { rate *= 0.6; }
    let alive = 0;
    for (const e of this.enemies) if (!e.inert && !e.d.hollow && e.alive) alive++;
    this.spawnAcc += rate * dt;
    // floor top-up is bounded by the wave's own rate so fast killers can't farm infinite spawns
    // Gloam Pressure: if the horde is being erased faster than it arrives, the dark pushes harder
    // so a strong build always has a tide to carve through (bounded by MAX_ENEMIES).
    if (this.boss) this.pressure = Math.max(1, this.pressure - dt * 1.5); // the tide recedes for a duel
    else if (t > 600 && alive < min * 0.4) this.pressure = Math.min(6, this.pressure + dt * 0.2);
    else if (alive > min * 0.8) this.pressure = Math.max(1, this.pressure - dt * 0.1);
    const late = this.pressure;
    this.spawnAcc += rate * (late - 1) * dt;
    if (alive < min) this.spawnAcc += Math.min((min - alive) * 2, rate * 2.5 * late) * dt;
    let n = Math.floor(this.spawnAcc);
    this.spawnAcc -= n;
    n = Math.min(n, Math.round(12 * late));
    for (let i = 0; i < n; i++) {
      const type = weightedObj(this.stagePool(wave));
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
        if (!this.boss && Math.random() < 0.25) {
          const bossPool = ['matron', 'colossus', 'herald'];
          this.runEvent({ type: 'boss', enemy: bossPool[(Math.random() * bossPool.length) | 0] });
        }
      }
    }
    // The Hollow: the run's hard limit. Unkillable, relentless, speeds up; more follow.
    if (!this.hollowWarned && t > this.hollowAt - 30) { this.hollowWarned = true; this.ui.toast('THE HOLLOW STIRS: 0:30', 'boss'); sfx.bossWarn(); }
    if (t >= this.hollowAt && this.hollowN < 8) {
      this.hollowN++;
      this.hollowAt = t + 60;
      const sp = this.spawnPointOffscreen(160);
      this.spawnEnemy('hollow', sp.x, sp.y, { force: true });
      this.ui.toast(this.hollowN === 1 ? 'THE HOLLOW HUNTS YOU. RUN.' : 'ANOTHER HOLLOW RISES', 'boss');
      sfx.hollowSpawn(); this.shake = Math.max(this.shake, 14);
    }
    // periodic elites between scripted ones
    this.eliteT += dt;
    if (t > 120 && this.eliteT > (Math.max(18, 60 - t / 30) * TUNE.eliteEvery) / (1 + 0.15 * (this.heat || 0))) {
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

  // merge the stage's enemy bias into a wave pool (cached per wave)
  stagePool(wave) {
    const key = this.stageId + ':' + this.curBiome, biome = this.curBiome > 0 ? this.stage.biomes[this.curBiome - 1] : null;
    if (wave._pools && wave._pools[key]) return wave._pools[key];
    const pool = { ...wave.pool };
    const unlockedAt = { husk: 105, beetle: 330, spitter: 270, wraith: 150, moth: 30, sentinel: 530, imp: 90, frostwisp: 90, lurker: 150, splitter: 210, scarab: 60, acolyte: 120, stormkite: 100 };
    for (const k in this.stage.bias) if (wave.at >= (unlockedAt[k] || 0)) pool[k] = (pool[k] || 0) + this.stage.bias[k];
    if (biome) for (const k in biome.bias) if (wave.at >= (unlockedAt[k] || 0)) pool[k] = (pool[k] || 0) + biome.bias[k];
    (wave._pools || (wave._pools = {}))[key] = pool;
    return pool;
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
    } else if (ev.type === 'spring') {
      const a = Math.random() * TAU, d = rand(260, 420);
      this.zones.push({ type: 'spring', x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, r: 100, t: 22, max: 22, color: 0x70ffb8 });
      this.ui.toast('A HEALING SPRING BUBBLES UP', 'pickup');
      sfx.shrineSpawn();
    } else if (ev.type === 'meteors') {
      this.meteorT = 12;
      this.ui.toast('METEOR SHOWER: watch the red circles', 'boss');
      sfx.bossWarn();
    } else if (ev.type === 'thief') {
      const sp = this.spawnPointOffscreen(60);
      this.spawnEnemy('thief', sp.x, sp.y, { force: true, life: 18 });
      this.ui.toast('AN EMBER THIEF! Catch it for a chest', 'pickup');
      sfx.thief();
    } else if (ev.type === 'omen') {
      this.buffs.bloodMoon = 20;
      this.ui.toast('BLOOD MOON: double experience, faster foes', 'boss');
      sfx.bloodMoon();
      this.flash(0xff2030, 0.35);
    } else if (ev.type === 'boss') {
      const sp = this.spawnPointOffscreen(120);
      this.spawnEnemy(ev.enemy, sp.x, sp.y, { force: true });
    }
  }

  updateEnemies(dt) {
    const P = this.player, es = this.enemies, ES = Math.min(1.5, this.stats.enemySpeed * (this.buffs.bloodMoon > 0 ? 1.3 : 1));
    const farX = this.halfW * 2 + 200, farY = this.halfH * 2 + 200;
    const kd = Math.exp(-9 * dt);
    let contactDmg = 0, contactSrc = '', contactBoss = null;
    for (let i = es.length - 1; i >= 0; i--) {
      const e = es[i];
      if (!e.alive) { e.p = null; e.glow = null; this.enemyPool.push(e); es[i] = es[es.length - 1]; es.pop(); continue; }
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
      if (e.d.hollow) { this.updateHollow(e, dt, dx, dy, dist); continue; }
      // relocate stragglers ahead of the player
      if (!e.boss && !e.rush && !e.d.flee && (Math.abs(P.x - e.x) > farX || Math.abs(P.y - e.y) > farY)) {
        const sp = this.spawnPointOffscreen();
        e.x = sp.x; e.y = sp.y;
        continue;
      }
      if (e.rush || e.d.flee) { e.life -= dt; if (e.life <= 0) { this.removeEnemy(e); continue; } }

      let mvx = 0, mvy = 0;
      if (e.freezeT > 0) {
        e.freezeT -= dt;
        p.tint = 0x90e0ff;
      } else {
        if (!e.elite) p.tint = e.d.tint || 0xffffff; else p.tint = 0xffe0a0;
        const sp = e.speed * ES * (e.slowT > 0 ? 0.5 : 1);
        if (e.slowT > 0) { e.slowT -= dt; p.tint = 0xb0d8ff; }
        if (e.rush) { mvx = e.rush.x * sp * 2.4; mvy = e.rush.y * sp * 2.4; }
        else if (e.d.flee) { mvx = -dx * sp; mvy = -dy * sp; }
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
            if (this.fx.length < this.maxFx * 0.6 && Math.random() < 0.4) this.spawnFx(T.smoke, e.x, e.y + 8, { life: 0.4, s0: 0.4, s1: 0.8, tint: 0x504060, a: 0.4, add: false });
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
          const wind = e.charging ? 0.15 : 1;
          mvx = dx * sp * wind; mvy = dy * sp * wind;
          if (dist > Math.max(this.halfW, this.halfH) * 1.6) {
            // bosses leap after a fleeing Bearer and land just off-screen
            const lp = this.spawnPointOffscreen(40);
            this.shockwave(e.x, e.y, 0xff3a6a, 200, 0.4);
            e.x = lp.x; e.y = lp.y;
            this.shockwave(e.x, e.y, 0xff3a6a, 260, 0.5);
            this.shake = Math.max(this.shake, 8);
          }
          this.bossAI(e, dt, dx, dy, dist);
        } else {
          mvx = dx * sp; mvy = dy * sp;
          if (e.d.shroud) p.alpha = this.time - e.lastBlink > 1.5 ? 0.55 : 1;
      if (e.d.submerge) {
            // cycle: sink (fast, faint, resists damage) -> surface near the Bearer (exposed)
            e.stT -= dt;
            if (e.stT <= 0) { e.sunk = !e.sunk; e.stT = e.sunk ? rand(1.8, 2.6) : rand(1.6, 2.2); if (!e.sunk) this.shockwave(e.x, e.y, 0x8ad070, 60, 0.35); }
            if (e.sunk) { mvx *= 1.4; mvy *= 1.4; }
          }
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
      if (e.d.chill && cdx * cdx + cdy * cdy < cr * cr && e.freezeT <= 0) P.chillT = 1.6;
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
      if (e.d.shroud) p.alpha = this.time - e.lastBlink > 1.5 ? 0.55 : 1;
      if (e.d.submerge) { p.alpha = e.sunk ? 0.22 : 1; p.texture = e.flash > 0 ? e.d._w[e.sunk ? 1 : 0] : e.d._t[e.sunk ? 1 : 0]; }
      if (e.glow) { e.glow.x = e.x; e.glow.y = e.y; e.glow.alpha = 0.45 + Math.sin(e.t * 4) * 0.15; }
      if (e.affix === 'vampiric' && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.025 * dt);
    }
    if (contactDmg > 0 && P.iframes <= 0) {
      const hpBefore = P.hp;
      this.hurtPlayer(contactDmg, 'touch:' + contactSrc);
      // Thorn Mail: reflect a share of the blow back at the attacker
      if (this.stats.thorns > 0 && P.hp < hpBefore) {
        const refl = contactDmg * this.stats.thorns;
        const near = this.enemiesIn(P.x, P.y - 10, 70, this.qExp);
        for (const t of near) if (!t.inert) this.damage(t, t.boss ? refl * 0.5 : refl);
        this.burst(P.x, P.y - 10, 14, [0xd8e8c0, 0x9ab07a], 260, 0.7, 'shard');
        this.shockwave(P.x, P.y - 10, 0x9ab07a, 70, 0.25);
      }
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

  // The Hollow never stops, cannot be hurt, and ends the run on touch (only a Moonfall blink saves you)
  updateHollow(e, dt, dx, dy, dist) {
    const P = this.player;
    e.t += dt;
    const sp = Math.min(200, e.speed + e.t * 0.5);
    e.x += dx * sp * dt; e.y += dy * sp * dt;
    e.anim += dt * 3;
    const p = e.p;
    p.texture = e.d._t[(e.anim | 0) & 1];
    p.x = e.x; p.y = e.y + Math.sin(e.t * 3) * 4;
    p.scaleX = e.scale * (dx < 0 ? -1 : 1); p.scaleY = e.scale;
    p.alpha = 0.9;
    if (e.glow) { e.glow.x = e.x; e.glow.y = e.y; e.glow.tint = 0x6a40c0; e.glow.alpha = 0.5 + Math.sin(e.t * 4) * 0.15; }
    if (this.fx.length < this.maxFx * 0.5 && Math.random() < dt * 24) {
      this.spawnFx(T.smoke, e.x + rand(-20, 20), e.y + rand(-10, 20), { life: 0.9, s0: 0.6, s1: 1.4, tint: 0x20103a, a: 0.5, add: false });
    }
    if (this.buffs.invuln > 0 || this.dead) return;
    if (dist < e.r + P.r) {
      (this.dmgLog || (this.dmgLog = {})).hollow = 9999;
      this.lastHitBy = 'touch:hollow';
      this.shockwave(P.x, P.y, 0x8040ff, 200, 0.5);
      this.die();
    }
  }

  bossAI(e, dt, dx, dy, dist) {
    e.stT -= dt;
    if (e.charging && Math.random() < dt * 30) {
      // gathering light while winding up
      const a = Math.random() * TAU, r = e.r * 1.6;
      this.spawnFx(T.dot, e.x + Math.cos(a) * r, e.y - 20 + Math.sin(a) * r, { life: 0.35, s0: 1.6, s1: 0, tint: e.d.slam ? 0xff7020 : 0xff3a6a, vx: -Math.cos(a) * r * 2.5, vy: -Math.sin(a) * r * 2.5, drag: 0 });
    }
    if (e.stT > 0) return;
    // telegraph: slams and novas wind up visibly before they fire
    if ((e.d.slam || e.d.nova || e.d.blink) && !e.charging) {
      e.charging = e.d.slam ? 0.8 : e.d.blink ? 0.7 : 0.5;
      e.stT = e.charging;
      if (e.d.slam) this.spawnFx(T.target, e.x, e.y, { life: 0.8, s0: 1, s1: 200 / 28, tint: 0xff3020, a: 0.85, drag: 0 });
      else this.spawnFx(T.glow, e.x, e.y - 20, { life: 0.5, s0: 1, s1: 4.5, tint: 0xff3a6a, a: 0.7, drag: 0 });
      return;
    }
    e.charging = 0;
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
    } else if (e.d.blink) {
      // vanish, then arrive close to the Bearer and erupt
      e.stT = 2.6; e.lastBlink = this.time;
      sfx.blink();
      const P = this.player, a = Math.random() * TAU, d = rand(110, 150);
      this.shockwave(e.x, e.y, 0xb8a8ff, 160, 0.4);
      this.burst(e.x, e.y - 40, 24, [0x2a2038, 0xb8a8ff], 260, 0.9, 'smoke');
      e.x = P.x + Math.cos(a) * d; e.y = P.y + Math.sin(a) * d;
      this.shockwave(e.x, e.y, 0xb8a8ff, 260, 0.5);
      this.shake = Math.max(this.shake, 8);
      for (let k = 0; k < 16; k++) {
        const b = (k / 16) * TAU;
        this.enemyShot(e.x, e.y - 40, Math.cos(b) * 120, Math.sin(b) * 120, e.dmg * 0.4);
        const c = b + TAU / 32; // offset faster outer ring closes the gaps
        this.enemyShot(e.x, e.y - 40, Math.cos(c) * 190, Math.sin(c) * 190, e.dmg * 0.4);
      }
      // aimed fan: fast orbs straight at the Bearer, so fleeing alone isn't enough
      const aim = Math.atan2(P.y - 12 - (e.y - 40), P.x - e.x);
      for (let k = -2; k <= 2; k++) this.enemyShot(e.x, e.y - 40, Math.cos(aim + k * 0.16) * 300, Math.sin(aim + k * 0.16) * 300, e.dmg * 0.5);
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

  enemyShot(x, y, vx, vy, dmg, tex = T.orb, scale = 1.3) {
    if (this.enemyShots.length > 400) return;
    const p = this.L.projAdd.add(tex, x, y);
    p.scaleX = p.scaleY = scale;
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
      if (g.exp && this.time > g.exp) { g.alive = false; this.L.pickups.kill(g.p); continue; }
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
      this.animPickup(g, p, dt);
      if (g.type === 'chest' && Math.random() < dt * 6) this.spawnFx(T.spark, g.x + rand(-18, 18), g.y + rand(-20, 6), { life: 0.6, s0: 0.5, s1: 0, tint: 0xffd060, vy: -40 });
      // occasional tier-coloured glints on visible gems (budgeted per frame)
      else if (g.type === 'gem' && this.glintBudget > 0 && Math.random() < dt * 0.6 && this.inView(g.x, g.y, -20)) {
        this.glintBudget--;
        const v = g.value, tint = v >= 200 ? 0xffe080 : v >= 40 ? 0xe0a0ff : v >= 10 ? 0xff9aa8 : v >= 3 ? 0xa0ffb8 : 0xbfe6ff;
        this.spawnFx(T.spark, g.x + rand(-4, 4), g.y - 6 + rand(-4, 4), { life: 0.35, s0: 0.7, s1: 0, tint, rot: Math.random(), spin: 4, drag: 0 });
      }
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

  // Soft obstacles: solid scenery resists but never blocks. The part of your motion pushing
  // into it is cut to 35% (so you slide along it, or wade through slowly); mud and drifts slow you.
  resolveObstacles(vx, vy, dt) {
    const C = 480, P = this.player, out = this._mv || (this._mv = { x: 0, y: 0 });
    let slow = this.obj.slowAt(P), wading = false;
    const cx = Math.floor(P.x / C), cy = Math.floor(P.y / C);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = this.obstacles.get((cx + a) + ',' + (cy + b));
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const ob = list[i];
        const dx = P.x - ob.x, dy = P.y - ob.y, R = ob.r + 10;
        if (dx > R || dx < -R || dy > R || dy < -R) continue;
        const d = Math.hypot(dx, dy);
        if (d >= R) continue;
        if (ob.slow) { slow = Math.min(slow, ob.slow); continue; }
        if (ob.haz) continue;
        const nx = dx / (d || 1), ny = dy / (d || 1), vn = vx * nx + vy * ny;
        if (vn < 0) { vx -= vn * nx * 0.65; vy -= vn * ny * 0.65; wading = true; }
        slow = Math.min(slow, 0.85);
      }
    }
    if (wading && (vx || vy) && Math.random() < dt * 8 && this.fx.length < this.maxFx * 0.5) {
      this.spawnFx(T.dot, P.x + rand(-8, 8), P.y + 4, { life: 0.35, s0: 0.9, s1: 0, tint: 0xb8a890, a: 0.6, vy: -20, vx: rand(-20, 20) });
    }
    out.x = vx * slow; out.y = vy * slow;
    return out;
  }

  // each Bearer's signature perk (passive ones are woven into damage/kill/hurt above)
  updatePerks(dt) {
    const P = this.player;
    this.perkT += dt;
    if (this.buffs.lantern > 0 && !this.dead) {
      this.lanternT -= dt;
      if (this.lanternT <= 0) {
        this.lanternT = 0.35;
        this.zones.push({ type: 'hearth', x: P.x, y: P.y, r: 90, t: 2.6, max: 2.6, tick: 0, dmg: (10 + this.level * 1.2) * this.stats.might, color: 0xffd060 });
      }
    }
    if (this.perk === 'salvage' && this.perkT > 40) {
      this.perkT = 0;
      const kinds = ['magnet', 'flareorb', 'freeze', 'bomb'];
      this.dropPickup(kinds[(Math.random() * kinds.length) | 0], P.x + rand(-60, 60), P.y + rand(-60, 60), 1);
      this.ui.toast('SALVAGE', 'pickup');
    } else if (this.perk === 'tollbearer' && this.perkT > 15) {
      this.perkT = 0;
      this.shockwave(P.x, P.y, 0xffc860, 340, 0.5);
      sfx.pulse();
      for (const e of this.enemiesIn(P.x, P.y, 180, this.qZone)) {
        if (e.inert || e.boss) continue;
        const dx = e.x - P.x, dy = e.y - P.y, dl = Math.hypot(dx, dy) || 1;
        e.kx += (dx / dl) * 320 * (1 - (e.d.knockRes || 0)); e.ky += (dy / dl) * 320 * (1 - (e.d.knockRes || 0));
        e.freezeT = Math.max(e.freezeT, 0.8);
      }
    }
  }

  // vents and other stage hazards: telegraph, then erupt
  updateHazards(dt) {
    const C = 480, P = this.player, cx = Math.floor(P.x / C), cy = Math.floor(P.y / C);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = this.obstacles.get((cx + a) + ',' + (cy + b));
      if (!list) continue;
      for (const ob of list) {
        if (!ob.haz) continue;
        ob.t -= dt;
        if (ob.ph === 0 && ob.t <= 0) {
          ob.ph = 1; ob.t = 0.9;
          this.zones.push({ type: 'telegraph', x: ob.x, y: ob.y, r: ob.haz.r + 8, t: 0.9, max: 0.9, color: ob.haz.color || 0xff5a20, onEnd: () => this.eruptVent(ob) });
        } else if (ob.ph === 1 && ob.t <= 0) { ob.ph = 0; ob.t = 4 + Math.random() * 5; }
      }
    }
  }
  eruptVent(ob) {
    const P = this.player;
    this.burst(ob.x, ob.y, 30, ob.haz.fx || [0xff7a30, 0xffd060, 0xffffff], 380, 0.9);
    this.shockwave(ob.x, ob.y, ob.haz.color || 0xff6a20, ob.haz.r * 2.6, 0.35);
    sfx.boom();
    if (Math.hypot(P.x - ob.x, P.y - ob.y) < ob.haz.r + 10) this.hurtPlayer(ob.haz.dmg * (1 + this.time / 1200), 'vent');
    const list = this.enemiesIn(ob.x, ob.y, ob.haz.r + 10, this.qZone);
    for (const e of list) if (!e.inert) this.damage(e, 30 + this.time / 10, { knock: 10, fx: ob.x, fy: ob.y });
  }

  // timed ground zones: telegraphs, healing springs, the Hearthkeeper's hearth
  updateZones(dt) {
    const P = this.player, zs = this.zones;
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      z.t -= dt;
      const inside = Math.hypot(P.x - z.x, P.y - z.y) < z.r;
      if (z.type === 'spring') {
        if (inside && !this.dead) {
          this.heal(this.stats.maxHp * 0.05 * dt, false);
          if (Math.random() < dt * 14) this.spawnFx(T.dot, z.x + rand(-z.r, z.r) * 0.7, z.y + rand(-z.r, z.r) * 0.7, { life: 0.8, s0: 1, s1: 0, tint: 0x80ffc0, vy: -50, a: 0.9 });
        }
      } else if (z.type === 'hearth') {
        z.tick -= dt;
        if (z.tick <= 0) {
          z.tick = 0.5;
          for (const e of this.enemiesIn(z.x, z.y, z.r, this.qZone)) if (!e.inert) this.damage(e, e.boss ? z.dmg * 0.5 : z.dmg, { knock: 2, fx: z.x, fy: z.y });
          if (inside) this.heal(2.5, false);
          this.burst(z.x + rand(-z.r, z.r) * 0.6, z.y + rand(-z.r, z.r) * 0.6, 3, [0xffb040, 0xffe080], 80, 0.7);
        }
      }
      if (z.t <= 0) { if (z.onEnd) z.onEnd(); zs[i] = zs[zs.length - 1]; zs.pop(); }
    }
    if (this.meteorT > 0) {
      this.meteorT -= dt;
      this.meteorAcc = (this.meteorAcc || 0) + dt;
      while (this.meteorAcc > 0.3) {
        this.meteorAcc -= 0.3;
        const near = Math.random() < 0.3;
        const x = near ? P.x + rand(-140, 140) : P.x + rand(-this.halfW, this.halfW) * 0.9;
        const y = near ? P.y + rand(-140, 140) : P.y + rand(-this.halfH, this.halfH) * 0.9;
        this.zones.push({ type: 'telegraph', x, y, r: 72, t: 1.15, max: 1.15, color: 0xff6030, onEnd: () => this.meteorImpact(x, y) });
      }
    }
  }
  meteorImpact(x, y) {
    this.explodeAt(x, y, 72, 50 + this.level * 3, null, 0xff8030, 14);
    this.shockwave(x, y, 0xffa040, 190, 0.35);
    this.shake = Math.max(this.shake, 5);
    sfx.boom();
    if (this.dead) return;
    const P = this.player;
    if (Math.hypot(P.x - x, P.y - y) < 80) this.hurtPlayer(10 * (1 + this.time / 900), 'meteor');
  }
  drawZones() {
    const g = this.zoneG;
    g.clear();
    for (const z of this.zones) {
      const k = 1 - z.t / (z.max || 1);
      if (z.type === 'telegraph') {
        g.circle(z.x, z.y, z.r).fill({ color: z.color, alpha: 0.06 + 0.22 * k });
        g.circle(z.x, z.y, z.r * (1 - 0.25 * k)).stroke({ color: z.color, width: 3, alpha: 0.4 + 0.5 * k });
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
        const fade = Math.min(1, z.t / 1.5);
        g.circle(z.x, z.y, z.r).fill({ color: z.color || 0x70ffb8, alpha: (0.1 + 0.05 * pulse) * fade });
        g.circle(z.x, z.y, z.r).stroke({ color: z.color || 0x70ffb8, width: 3, alpha: (0.5 + 0.3 * pulse) * fade });
      }
    }
  }

  // ---------- biomes: some stages change character the farther you travel in a direction ----------
  biomeWeights(x, y) {
    const B = this.stage.biomes, d = Math.hypot(x, y);
    const k = Math.max(0, Math.min(1, (d - 900) / 1300)), ramp = k * k * (3 - 2 * k);
    const th = Math.atan2(y, x) + 0.35 * Math.sin(x * 0.0011 + y * 0.0007) + 0.25 * Math.sin(y * 0.0013 - x * 0.0009);
    const w = [1 - ramp];
    let tot = 0;
    for (const b of B) { const c = Math.max(0, Math.cos(th - b.ang)); const v = c * c * c + 0.002; w.push(v); tot += v; }
    for (let i = 1; i < w.length; i++) w[i] = (w[i] / tot) * ramp;
    return w;
  }
  biomeAt(x, y) {
    if (!this.stage.biomes) return 0;
    const w = this.biomeWeights(x, y);
    let bi = 0; for (let i = 1; i < w.length; i++) if (w[i] > w[bi]) bi = i;
    return bi;
  }
  updateBiome(dt) {
    this.biomeT -= dt;
    if (this.biomeT > 0) return;
    this.biomeT = 0.15;
    const P = this.player, w = this.biomeWeights(P.x, P.y), B = this.stage.biomes;
    let r = 0, gr = 0, b = 0;
    const cols = [this.stage.tint, ...B.map((x) => x.tint)];
    for (let i = 0; i < w.length; i++) { r += ((cols[i] >> 16) & 255) * w[i]; gr += ((cols[i] >> 8) & 255) * w[i]; b += (cols[i] & 255) * w[i]; }
    this.ground.tint = ((r | 0) << 16) | ((gr | 0) << 8) | (b | 0);
    let bi = 0; for (let i = 1; i < w.length; i++) if (w[i] > w[bi]) bi = i;
    if (bi !== this.curBiome && (bi === 0 || w[bi] > 0.62)) {
      this.curBiome = bi;
      this.ui.toast(`ENTERING ${bi ? B[bi - 1].name : this.stage.homeName}`, 'kindle');
    }
  }

  // gales on stormy stages: everything is shoved the same way for a few seconds
  updateWind(dt) {
    const W = this.stage.wind, P = this.player;
    this.windT -= dt;
    if (this.windT <= 0) {
      if (this.wind) { this.wind = null; this.windT = W.every; } else {
        const a = Math.random() * TAU;
        this.wind = { vx: Math.cos(a) * W.push, vy: Math.sin(a) * W.push, t: W.dur };
        this.windT = W.dur;
        this.ui.toast('A GALE ROARS IN: braced feet, quick hands', 'warn');
        sfx.bossWarn();
      }
    }
    if (!this.wind) return;
    const w = this.wind;
    if (!this.dead) {
      const mvr = this.resolveObstacles(w.vx, w.vy, dt);
      P.x += mvr.x * dt; P.y += mvr.y * dt;
    }
    const ex = w.vx * 0.7 * dt, ey = w.vy * 0.7 * dt;
    for (const e of this.enemies) if (e.alive && !e.d.boss && e.d.speed > 0) { e.x += ex; e.y += ey; }
    this.windAcc = (this.windAcc || 0) + dt;
    while (this.windAcc > 0.03) {
      this.windAcc -= 0.03;
      this.spawnFx(T.dot, P.x + rand(-this.halfW, this.halfW), P.y + rand(-this.halfH, this.halfH), { life: 0.6, s0: 0.9, s1: 0.2, tint: 0xdff4ff, vx: w.vx * 5, vy: w.vy * 5, a: 0.55 });
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
      const ps = [], obs = [];
      const n = 5 + ((r() * 7) | 0);
      for (let i = 0; i < n; i++) {
        const dx = cx * C + r() * C, dy = cy * C + r() * C;
        const bi = this.biomeAt(dx, dy), cfg = bi > 0 ? this.stage.biomes[bi - 1] : this.stage;
        const dec = cfg.decor;
        let tot = 0; for (const dk in dec) tot += dec[dk];
        let v = r() * tot, name = 'grass';
        for (const dk in dec) { v -= dec[dk]; if (v <= 0) { name = dk; break; } }
        const p = this.L.decor.add(T[name], dx, dy);
        const solid = cfg.solids && cfg.solids[name], slow = cfg.slows && cfg.slows[name], haz = cfg.hazards && cfg.hazards[name];
        if (solid || slow || haz) obs.push({ x: dx, y: dy - 4, r: solid || (slow ? slow[0] : haz.r), slow: slow ? slow[1] : 0, haz: haz || null, ph: 0, t: 2 + r() * 6 });
        p.anchorY = 0.85;
        if (r() < 0.5) p.scaleX = -1;
        p.alpha = 0.8;
        p.tint = cfg.own && cfg.own.includes(name) ? 0xffffff : cfg.decorTint || this.stage.decorTint;
        ps.push(p);
      }
      this.chunks.set(k, ps);
      this.obstacles.set(k, obs);
    }
    for (const [k, ps] of this.chunks) {
      if (want.has(k)) continue;
      for (const p of ps) this.L.decor.kill(p);
      this.chunks.delete(k);
      this.obstacles.delete(k);
    }
  }

  // ---------- render ----------
  // adaptive quality: trim the particle budget when frames fall behind, restore when smooth
  adaptQuality(rawDt) {
    if (rawDt <= 0) return;
    this.frameAvg += (rawDt - this.frameAvg) * 0.05;
    this.qualT += rawDt;
    if (this.qualT < 1) return;
    this.qualT = 0;
    if (this.frameAvg > 0.02) this.maxFx = Math.max(800, Math.round(this.maxFx * 0.85));
    else if (this.frameAvg < 0.0175) this.maxFx = Math.min(this.baseFx, Math.round(this.maxFx * 1.08) + 20);
  }

  render(rawDt) {
    this.adaptQuality(rawDt);
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

    if (this.motes.length) this.updateMotes(rawDt, sw, sh, z);
    // player
    const ps = this.playerSprite;
    P.bob += rawDt * (P.moving ? 14 : 3);
    ps.x = P.x; ps.y = P.y + (P.moving ? -Math.abs(Math.sin(P.bob)) * 3 : 0);
    const step = P.moving ? Math.sin(P.bob) : 0;
    ps.texture = T[this.char.sprite + (step > 0.35 ? '_s1' : step < -0.35 ? '_s2' : '')];
    if (P.fx !== 0) ps.scale.x = P.fx < 0 ? -1 : 1;
    ps.scale.y = 1 + Math.sin(P.bob * 0.5) * (P.moving ? 0 : 0.02);
    ps.tint = P.hurtT > 0 ? 0xff6060 : P.chillT > 0 ? 0x9ad8ff : this.buffs.bloodrage > 0 ? 0xff9090 : 0xffffff;
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
      // a pale ghost bar trails behind damage, then catches up
      if (P.hpGhost === undefined || r >= P.hpGhost) { P.hpGhost = r; P.ghostHold = 0.35; }
      else if ((P.ghostHold -= rawDt) <= 0) P.hpGhost = Math.max(r, P.hpGhost - rawDt * 0.6);
      hb.rect(P.x - 18, P.y + 8, 36, 5).fill({ color: 0x120814, alpha: 0.85 });
      if (P.hpGhost > r) hb.rect(P.x - 17, P.y + 9, 34 * P.hpGhost, 3).fill({ color: 0xffffff, alpha: 0.6 });
      hb.rect(P.x - 17, P.y + 9, 34 * r, 3).fill(P.hurtT > 0.18 ? 0xffffff : r > 0.5 ? 0x5aff8a : r > 0.25 ? 0xffd040 : 0xff4050);
    }

    this.drawIndicators(sw, sh);
    this.drawShrine();
    this.drawZones();
    this.objG.clear(); this.obj.draw(this.objG);

    // screen overlays
    this.hurtFlash = Math.max(0, (this.hurtFlash || 0) - rawDt * 2);
    const low = 1 - P.hp / this.stats.maxHp;
    const kt2 = this.kindleTier, target = kt2 >= 2 ? Math.min(0.42, (kt2 - 1) * 0.08) * (kt2 >= 5 ? 0.85 + Math.sin(this.time * 5) * 0.15 : 1) : 0;
    this.kindleGlow.alpha += (target - this.kindleGlow.alpha) * Math.min(1, rawDt * 3);
    this.kindleGlow.tint = kt2 >= 5 ? 0xffc040 : 0xff7a20;
    this.hurtVignette.alpha = Math.max(this.hurtFlash, low > 0.6 ? (low - 0.6) * 1.5 * (0.7 + Math.sin(this.time * 6) * 0.3) : 0);
    this.flashAlpha = Math.max(0, this.flashAlpha - rawDt * 2.2);
    this.flashG.clear();
    if (this.flashAlpha > 0.01) this.flashG.rect(0, 0, sw, sh).fill({ color: this.flashColor, alpha: this.flashAlpha * 0.6 });

    for (const k in this.L) this.L[k].flush();
    this.ui.updateHUD(this);
  }

  // one-time contextual onboarding hints, each shown once ever
  checkHints() {
    if (this.hintCd > 0) { this.hintCd -= 1 / 60; return; }
    const H = save.hints, touch = matchMedia('(pointer: coarse)').matches;
    const show = (id, text) => { if (H[id]) return false; H[id] = true; persist(); this.ui.hintPop(text); this.hintCd = 6; return true; };
    if (this.time > 0.5 && show('move', touch ? 'Drag anywhere to move. Your weapons fire on their own.' : 'Move with WASD or the arrow keys. Your weapons fire on their own.')) return;
    if (this.pickups.some((p) => p.alive && p.type === 'gem') && show('gems', 'Gather the gems the dark leaves behind. They level you up.')) return;
    if (this.combo >= 12 && show('kindle', 'Keep killing to build your Kindle streak: more XP and cinders. Stop and it fades.')) return;
    if (this.flare >= 100 && show('flare', touch ? 'Your Flare is ready! Tap the ✹ button to unleash it.' : 'Your Flare is ready! Press SPACE to unleash it.')) return;
    if (this.pickups.some((p) => p.alive && p.type === 'chest')) show('chest', 'A relic chest! Grab it for free upgrades. Golden arrows point to chests off-screen.');
  }

  checkFeats() {
    for (const id in FEATS) {
      if (save.feats[id] || !FEATS[id].check(this)) continue;
      save.feats[id] = true;
      save.cinders += FEATS[id].reward;
      this.featsEarned.push(id);
      persist();
      sfx.chestOpen();
      this.ui.featPop(FEATS[id]);
    }
  }

  // Ember Shrines: hold position inside the circle for 5s to earn a relic chest
  updateShrine(dt) {
    const P = this.player;
    if (!this.shrine) {
      this.shrineT -= dt;
      if (this.shrineT <= 0 && !this.boss) {
        const a = Math.random() * TAU, d = rand(520, 820);
        this.shrine = { x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, r: 95, prog: 0, life: 45, t: 0 };
        this.ui.toast('AN EMBER SHRINE STIRS', 'pickup');
        sfx.shrineSpawn();
      }
      return;
    }
    const sh = this.shrine;
    sh.life -= dt; sh.t += dt;
    const inside = Math.hypot(P.x - sh.x, P.y - sh.y) < sh.r;
    sh.prog = Math.max(0, Math.min(1, sh.prog + (inside ? dt / 5 : -dt / 12)));
    if (inside && sh.prog < 1) sfx.shrineTick(sh.prog);
    if (inside && Math.random() < dt * 25) {
      const a = Math.random() * TAU;
      this.spawnFx(T.dot, sh.x + Math.cos(a) * sh.r, sh.y + Math.sin(a) * sh.r, { life: 0.6, s0: 1.4, s1: 0, tint: 0x7af0ff, vx: -Math.cos(a) * 140, vy: -Math.sin(a) * 140, drag: 0 });
    }
    if (sh.prog >= 1) {
      this.dropPickup('chest', sh.x, sh.y, 1);
      this.burst(sh.x, sh.y, 60, [0x7af0ff, 0xffffff, 0xffd060], 500, 1.1);
      this.shockwave(sh.x, sh.y, 0x7af0ff, 400, 0.6);
      sfx.chestOpen();
      this.ui.toast('SHRINE KINDLED', 'fusion');
      // the dark answers: a ring of the current wave closes in
      const pool = Object.keys(WAVES[this.waveIdx].pool);
      this.runEvent({ type: 'ring', enemy: pool[(Math.random() * pool.length) | 0], count: 24 + Math.floor(this.time / 30) });
      this.shrine = null; this.shrineT = rand(100, 140);
    } else if (sh.life <= 0) {
      this.shrine = null; this.shrineT = rand(60, 90);
    }
  }

  drawShrine() {
    const g = this.shrineG, sh = this.shrine;
    g.clear();
    if (!sh) return;
    const fade = Math.min(1, sh.life / 3, sh.t * 2);
    const pulse = 1 + Math.sin(sh.t * 4) * 0.04;
    g.circle(sh.x, sh.y, sh.r * pulse).fill({ color: 0x2ad0ff, alpha: 0.08 * fade }).stroke({ color: 0x7af0ff, width: 3, alpha: 0.7 * fade });
    g.circle(sh.x, sh.y, sh.r * 0.35).fill({ color: 0x7af0ff, alpha: 0.25 * fade });
    if (sh.prog > 0) {
      g.moveTo(sh.x + sh.r + 8, sh.y);
      g.arc(sh.x, sh.y, sh.r + 8, 0, sh.prog * TAU).stroke({ color: 0xffd060, width: 6, alpha: 0.95 * fade });
    }
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
    for (const pk of this.pickups) if (pk.alive && pk.type === 'chest') mark(pk.x, pk.y, CHEST_COL[pk.tier] || 0xffcf4a, 10);
    if (this.boss && this.boss.alive) mark(this.boss.x, this.boss.y, 0xff3a6a, 14);
    if (this.shrine) mark(this.shrine.x, this.shrine.y, 0x7af0ff, 11);
    for (const t of this.obj.targets()) mark(t.x, t.y, 0x40e8d8, 13);
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}

// ---------- utils ----------
// damage numbers take their weapon's element colour (fusions use their first parent's)
const ELEMENT_TINT = { fire: 0xffb070, frost: 0xb0e8ff, storm: 0x9ef0ff, steel: 0xe4e6ee, spirit: 0x9affe0, nature: 0xffa8d4, holy: 0xfff0b0, void: 0xd0b0ff };
const tintCache = {};
function elementTint(id) {
  if (tintCache[id] != null) return tintCache[id];
  const w = WEAPONS[id] || (FUSIONS[id] && WEAPONS[FUSIONS[id].parents[0]]);
  return (tintCache[id] = (w && ELEMENT_TINT[w.element]) || 0xffffff);
}
function bossName(t) { return { matron: 'THE BROOD MATRON', colossus: 'THE CINDER COLOSSUS', herald: 'THE GLOAM HERALD', tyrant: 'THE ECLIPSE TYRANT' }[t] || t.toUpperCase(); }
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
