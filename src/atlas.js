import { HEX, rgba, SHADOW, PROP_RULE, RIM } from './palette.js';
// Procedural sprite atlas. Every sprite in Emberwake is drawn here with Canvas2D
// into ONE texture source, so all ParticleContainers can batch from it.
import { Texture, Rectangle, CanvasSource } from 'pixi.js';

// Logical atlas size; the backing canvas is supersampled SS× for crisp sprites on
// HiDPI screens and camera zoom. Pixi maps it back via the source's resolution.
const SIZE = 2048, SIZE_H = 1280;
export const SS = 2;
export const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = SIZE * SS;
atlasCanvas.height = SIZE_H * SS;
const actx = atlasCanvas.getContext('2d', { willReadFrequently: true });

const frames = {};
export const T = {};
let sx = 0, sy = 0, sh = 0;
const PAD = 2;

function alloc(w, h) {
  if (sx + w + PAD > SIZE) { sx = 0; sy += sh + PAD; sh = 0; }
  if (sy + h > SIZE_H) console.warn('atlas overflow', w, h);
  const r = { x: sx, y: sy, w, h };
  sx += w + PAD;
  sh = Math.max(sh, h);
  return r;
}

function make(name, w, h, draw) {
  const r = alloc(w, h);
  actx.save();
  actx.translate(r.x * SS, r.y * SS);
  actx.scale(SS, SS);
  actx.beginPath();
  actx.rect(0, 0, w, h);
  actx.clip();
  draw(actx, w, h);
  actx.restore();
  frames[name] = r;
  return r;
}

// Hit-flash variant of a frame: solid body pixels turn white, while soft pixels
// (drop shadows, glows, coronas) keep their colour so flashes read as the creature.
function makeWhite(name) {
  const src = frames[name];
  const r = alloc(src.w, src.h);
  const img = actx.getImageData(src.x * SS, src.y * SS, src.w * SS, src.h * SS);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a > 150) { const k = (a - 150) / 105; d[i] += (255 - d[i]) * k; d[i + 1] += (255 - d[i + 1]) * k; d[i + 2] += (255 - d[i + 2]) * k; }
  }
  actx.putImageData(img, r.x * SS, r.y * SS);
  frames[name + '_w'] = r;
}

// ---------- drawing helpers ----------
const TAU = Math.PI * 2;
let seed = 1337;
export let groundSeed = seed;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function circle(c, x, y, r, fill, stroke, lw = 2) {
  c.beginPath(); c.arc(x, y, r, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function ellipse(c, x, y, rx, ry, fill, stroke, lw = 2) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function radial(c, x, y, r, stops) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
function lin(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
function glowDot(c, x, y, r, col) {
  c.fillStyle = radial(c, x, y, r, [[0, HEX.WHITE], [0.3, col], [1, rgba(HEX.INK, 0)]]);
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function shadow(c, x, y, rx, ry = rx * 0.35, alpha = SHADOW.alpha) {
  c.fillStyle = radial(c, 0, 0, 1, [[0, rgba(HEX.INK, alpha)], [1, rgba(HEX.INK, 0)]]);
  c.save(); c.translate(x, y); c.scale(rx, ry);
  c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
}
function eye(c, x, y, r, col) {
  glowDot(c, x, y, r * 2.2, col);
  circle(c, x, y, r, HEX.WHITE);
  circle(c, x, y, r * 0.5, col);
}
function poly(c, pts, fill, stroke, lw = 2) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
}
function star(x, y, r1, r2, n, rot = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU, r = i % 2 ? r2 : r1;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return pts;
}
const OUT = HEX.INK;

// ---------- FX ----------
function drawFX() {
  make('glow', 64, 64, (c) => {
    c.fillStyle = radial(c, 32, 32, 32, [[0, HEX.WHITE], [0.25, rgba(HEX.WHITE, 0.6)], [1, rgba(HEX.WHITE, 0)]]);
    c.fillRect(0, 0, 64, 64);
  });
  make('softglow', 128, 128, (c) => {
    c.fillStyle = radial(c, 64, 64, 64, [[0, rgba(HEX.WHITE, 0.7)], [0.5, rgba(HEX.WHITE, 0.18)], [1, rgba(HEX.WHITE, 0)]]);
    c.fillRect(0, 0, 128, 128);
  });
  make('dot', 12, 12, (c) => {
    c.fillStyle = radial(c, 6, 6, 6, [[0, HEX.WHITE], [0.5, rgba(HEX.WHITE, 0.9)], [1, rgba(HEX.WHITE, 0)]]);
    c.fillRect(0, 0, 12, 12);
  });
  make('spark', 24, 24, (c) => {
    c.fillStyle = radial(c, 12, 12, 12, [[0, rgba(HEX.WHITE, 0.8)], [1, rgba(HEX.WHITE, 0)]]);
    c.fillRect(0, 0, 24, 24);
    poly(c, star(12, 12, 12, 2, 4, 0), HEX.WHITE);
  });
  make('shard', 12, 12, (c) => poly(c, [[6, 0], [12, 6], [6, 12], [0, 6]], HEX.WHITE));
  make('streak', 32, 6, (c) => {
    c.fillStyle = lin(c, 0, 0, 32, 0, [[0, rgba(HEX.WHITE, 0)], [0.7, rgba(HEX.WHITE, 0.8)], [1, HEX.WHITE]]);
    c.beginPath(); c.ellipse(16, 3, 16, 3, 0, 0, TAU); c.fill();
  });
  make('smoke', 40, 40, (c) => {
    for (let i = 0; i < 6; i++) {
      const x = 20 + (rnd() - 0.5) * 14, y = 20 + (rnd() - 0.5) * 14;
      c.fillStyle = radial(c, x, y, 13, [[0, rgba(HEX.WHITE, 0.35)], [1, rgba(HEX.WHITE, 0)]]);
      c.beginPath(); c.arc(x, y, 13, 0, TAU); c.fill();
    }
  });
  make('ring', 128, 128, (c) => {
    c.strokeStyle = rgba(HEX.WHITE, 0.25); c.lineWidth = 10;
    c.beginPath(); c.arc(64, 64, 57, 0, TAU); c.stroke();
    c.strokeStyle = rgba(HEX.WHITE, 0.9); c.lineWidth = 3;
    c.beginPath(); c.arc(64, 64, 58, 0, TAU); c.stroke();
  });
  make('aura', 160, 160, (c) => {
    c.fillStyle = radial(c, 80, 80, 80, [[0, rgba(HEX.WHITE, 0)], [0.65, rgba(HEX.WHITE, 0.05)], [0.92, rgba(HEX.WHITE, 0.35)], [1, rgba(HEX.WHITE, 0)]]);
    c.fillRect(0, 0, 160, 160);
    c.strokeStyle = rgba(HEX.WHITE, 0.7); c.lineWidth = 2; c.setLineDash([10, 8]);
    c.beginPath(); c.arc(80, 80, 72, 0, TAU); c.stroke();
  });
  make('beam', 64, 28, (c) => {
    c.fillStyle = lin(c, 0, 0, 0, 28, [[0, rgba(HEX.WHITE, 0)], [0.3, rgba(HEX.WHITE, 0.4)], [0.5, HEX.WHITE], [0.7, rgba(HEX.WHITE, 0.4)], [1, rgba(HEX.WHITE, 0)]]);
    c.fillRect(0, 0, 64, 28);
  });
  make('bolt_seg', 32, 10, (c) => {
    c.fillStyle = lin(c, 0, 0, 0, 10, [[0, rgba(HEX.WHITE, 0)], [0.5, HEX.WHITE], [1, rgba(HEX.WHITE, 0)]]);
    c.fillRect(0, 0, 32, 10);
  });
  make('slash', 128, 128, (c) => {
    // crescent arc pointing right
    c.save(); c.translate(64, 64);
    const g = c.createLinearGradient(0, -60, 0, 60);
    g.addColorStop(0, rgba(HEX.WHITE, 0)); g.addColorStop(0.5, HEX.WHITE); g.addColorStop(1, rgba(HEX.WHITE, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 60, -1.3, 1.3); c.arc(-18, 0, 50, 1.2, -1.2, true); c.closePath(); c.fill();
    c.restore();
  });
  make('target', 64, 64, (c) => {
    c.strokeStyle = rgba(HEX.WHITE, 0.9); c.lineWidth = 3; c.setLineDash([8, 6]);
    c.beginPath(); c.arc(32, 32, 28, 0, TAU); c.stroke();
    c.setLineDash([]);
    c.fillStyle = rgba(HEX.WHITE, 0.15); c.beginPath(); c.arc(32, 32, 28, 0, TAU); c.fill();
  });
  make('shadow', 48, 18, (c) => shadow(c, 24, 9, 23, 8));
  make('pixel', 4, 4, (c) => { c.fillStyle = HEX.WHITE; c.fillRect(0, 0, 4, 4); });
}

// ---------- projectiles ----------
function drawProjectiles() {
  // Ember Bolt: comet-shaped flame pointing right (+x), two flicker frames
  for (const f of [0, 1]) make('flame' + f, 44, 26, (c) => {
    c.save(); c.translate(30, 13);
    c.fillStyle = radial(c, 0, 0, 16, [[0, rgba(HEX.EMBER, 0.8)], [1, rgba(HEX.EMBER_D, 0)]]);
    c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill();
    const tail = f ? 30 : 26, wob = f ? 2 : -2;
    const shape = (len, w, col) => {
      c.beginPath(); c.moveTo(9, 0);
      c.bezierCurveTo(8, -w, -len * 0.4, -w * 0.8 + wob, -len, wob * 0.5);
      c.bezierCurveTo(-len * 0.4, w * 0.8 + wob, 8, w, 9, 0);
      c.fillStyle = col; c.fill();
    };
    shape(tail, 8, rgba(HEX.EMBER_D, 0.85));
    shape(tail * 0.72, 5.5, HEX.EMBER);
    shape(tail * 0.42, 3.4, HEX.EMBER_H);
    circle(c, 4, 0, 3, HEX.WHITE);
    c.restore();
  });
  make('bolt', 32, 32, (c) => {
    glowDot(c, 16, 16, 16, rgba(HEX.EMBER, 0.9));
    circle(c, 16, 16, 7, HEX.EMBER_L);
    circle(c, 16, 16, 4, HEX.WHITE);
  });
  make('blade', 40, 40, (c) => {
    c.save(); c.translate(20, 20);
    glowDot(c, 0, 0, 20, rgba(HEX.FROST, 0.35));
    c.beginPath(); c.arc(0, 0, 15, -2.2, 0.8); c.arc(5, -3, 10, 0.6, -2.0, true); c.closePath();
    c.fillStyle = lin(c, -15, -15, 15, 15, [[0, HEX.FROST_H], [1, HEX.FROST]]); c.fill();
    c.lineWidth = 1.5; c.strokeStyle = HEX.INK; c.stroke();
    c.restore();
  });
  // Wisp spirit: teal teardrop with tiny eyes, pointing right (+x), two flutter frames
  for (const f of [0, 1]) make('spirit' + f, 36, 24, (c) => {
    c.save(); c.translate(24, 12);
    glowDot(c, 0, 0, 12, rgba(HEX.OBJ, 0.55));
    const w = f ? 2.5 : -2.5;
    c.beginPath(); c.moveTo(8, 0);
    c.bezierCurveTo(7, -7, -6, -6 + w, -20, w);
    c.bezierCurveTo(-6, 6 + w, 7, 7, 8, 0);
    c.fillStyle = lin(c, -20, 0, 8, 0, [[0, rgba(HEX.OBJ_D, 0)], [0.5, rgba(HEX.OBJ, 0.85)], [1, HEX.FROST_H]]); c.fill();
    circle(c, 1, 0, 5.5, HEX.OBJ);
    circle(c, 2.6, -1.8, 1.2, HEX.MOSS_D); circle(c, 2.6, 1.8, 1.2, HEX.MOSS_D);
    c.restore();
  });
  // Drone spark: cyan core with jagged electric arcs, two crackle frames
  for (const f of [0, 1]) make('zap' + f, 22, 22, (c) => {
    glowDot(c, 11, 11, 11, rgba(HEX.FROST, 0.75));
    c.strokeStyle = HEX.FROST_H; c.lineWidth = 1.4; c.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + (f ? 0.6 : 0.1);
      c.beginPath(); c.moveTo(11, 11);
      c.lineTo(11 + Math.cos(a + 0.4) * 5, 11 + Math.sin(a + 0.4) * 5);
      c.lineTo(11 + Math.cos(a - 0.2) * 9, 11 + Math.sin(a - 0.2) * 9);
      c.stroke();
    }
    circle(c, 11, 11, 3.2, HEX.WHITE);
  });
  make('wisp', 28, 28, (c) => {
    glowDot(c, 14, 14, 14, rgba(HEX.OBJ, 0.8));
    circle(c, 14, 14, 5, HEX.FROST_H);
  });
  make('glaive', 48, 48, (c) => {
    c.save(); c.translate(24, 24);
    glowDot(c, 0, 0, 24, rgba(HEX.SLATE_H, 0.4));
    for (let i = 0; i < 3; i++) {
      c.rotate(TAU / 3);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(14, -6, 20, -18); c.quadraticCurveTo(10, -4, 0, 0);
      c.fillStyle = HEX.FROST_H; c.fill(); c.lineWidth = 1.5; c.strokeStyle = HEX.INK; c.stroke();
    }
    circle(c, 0, 0, 6, HEX.MOON, HEX.INK, 1.5);
    c.restore();
  });
  make('meteor', 48, 48, (c) => {
    glowDot(c, 24, 24, 24, rgba(HEX.EMBER, 0.8));
    poly(c, [[14, 18], [24, 10], [35, 15], [38, 27], [30, 37], [17, 35], [11, 27]], HEX.WOOD, HEX.INK, 2);
    circle(c, 26, 22, 4, HEX.SKIN); circle(c, 19, 29, 3, HEX.EMBER);
  });
  make('mine', 32, 32, (c) => {
    c.save(); c.translate(16, 16);
    for (let i = 0; i < 6; i++) {
      c.rotate(TAU / 6);
      ellipse(c, 0, -8, 4.5, 8, HEX.R_PINK, HEX.INK, 1.5);
    }
    circle(c, 0, 0, 6, HEX.R_GOLD, HEX.INK, 1.5);
    c.restore();
  });
  make('drone', 36, 36, (c) => {
    c.save(); c.translate(18, 18);
    glowDot(c, 0, 4, 14, rgba(HEX.FROST, 0.4));
    ellipse(c, -11, -6, 6, 2.5, HEX.SLATE_H, OUT, 1.2); ellipse(c, 11, -6, 6, 2.5, HEX.SLATE_H, OUT, 1.2);
    poly(c, [[-9, -2], [9, -2], [11, 6], [0, 11], [-11, 6]], HEX.SAND, OUT, 2);
    circle(c, 0, 3, 4, HEX.OBJ);
    circle(c, 0, 3, 2, HEX.WHITE);
    c.restore();
  });
  make('orb', 20, 20, (c) => {
    glowDot(c, 10, 10, 10, rgba(HEX.VOID, 0.9));
    circle(c, 10, 10, 4, HEX.RIM);
  });
  make('icicle', 28, 12, (c) => {
    poly(c, [[0, 6], [8, 1], [28, 6], [8, 11]], HEX.FROST_H, HEX.INK, 1.5);
  });
  make('vortex', 128, 128, (c) => {
    c.save(); c.translate(64, 64);
    c.fillStyle = radial(c, 0, 0, 64, [[0, rgba(HEX.WHITE, 0.95)], [0.12, rgba(HEX.VOID, 0.9)], [0.35, rgba(HEX.R_VIOLET, 0.55)], [1, rgba(HEX.INK, 0)]]);
    c.beginPath(); c.arc(0, 0, 64, 0, TAU); c.fill();
    for (let arm = 0; arm < 4; arm++) {
      c.save(); c.rotate((arm / 4) * TAU);
      c.beginPath();
      for (let t = 0; t <= 1; t += 0.04) {
        const r = 8 + t * 54, a = t * 3.4;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (t === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.lineWidth = 5; c.strokeStyle = rgba(HEX.MOON, 0.75); c.lineCap = 'round'; c.stroke();
      c.restore();
    }
    circle(c, 0, 0, 7, HEX.INK, rgba(HEX.WHITE, 0.9), 2);
    c.restore();
  });
  make('feather', 30, 14, (c) => {
    glowDot(c, 15, 7, 12, rgba(HEX.EMBER_H, 0.5));
    ellipse(c, 15, 7, 13, 4, HEX.R_LIGHT, HEX.INK, 1.2);
  });
}

// ---------- pickups ----------
// pips: tier marks (0-4) so gem value reads without relying on colour
// thin light rim just inside an outline: assumes the shape's path is current
function rim(c, light, dark, lw = 1.6) {
  c.save(); c.clip(); c.lineWidth = lw * 2 + 1.4; c.strokeStyle = light; c.stroke(); c.restore();
  c.lineWidth = lw; c.strokeStyle = dark; c.lineJoin = 'round'; c.stroke();
}
function gem(name, light, mid, dark, s = 1, pips = 0) {
  const w = Math.round(22 * s), h = Math.round(28 * s);
  make(name, w, h, (c) => {
    c.save(); c.scale(s, s);
    glowDot(c, 11, 14, 12, rgba(mid, 0.62));
    const body = [[11, 2], [19, 12], [11, 26], [3, 12]];
    poly(c, body, mid);
    poly(c, [[11, 2], [3, 12], [11, 14]], light);
    poly(c, [[19, 12], [11, 14], [11, 26]], dark);
    c.fillStyle = radial(c, 11, 11, 8, [[0, rgba(HEX.WHITE, 0.55)], [1, rgba(HEX.WHITE, 0)]]);
    c.beginPath(); c.arc(11, 11, 8, 0, TAU); c.fill();
    poly(c, body); rim(c, rgba(HEX.WHITE, 0.8), dark, 1.6);
    circle(c, 9, 9, 1.8, HEX.WHITE);
    for (let i = 0; i < pips; i++) {
      const x = 11 + (i - (pips - 1) / 2) * 3.4;
      poly(c, [[x, 17], [x + 1.4, 18.6], [x, 20.2], [x - 1.4, 18.6]], HEX.WHITE, rgba(HEX.INK, 0.55), 0.6);
    }
    c.restore();
  });
}
// ---- treasure chests: 44x38, a halo, lid ajar with light leaking out (all but bronze) ----
function chest(name, o) {
  make(name, 44, 38, (c) => {
    shadow(c, 22, 34, 20, 5);
    glowDot(c, 22, 19, 22, o.halo);
    c.strokeStyle = OUT; c.lineWidth = 2.5; c.lineJoin = 'round';
    // body
    c.fillStyle = lin(c, 0, 17, 0, 33, [[0, o.body[0]], [1, o.body[1]]]);
    c.beginPath(); c.roundRect(5, 17, 34, 16, 3); c.fill(); c.stroke();
    // light leaking from the gap
    c.fillStyle = radial(c, 22, 15, 20, [[0, o.leak], [0.5, o.leakMid], [1, rgba(HEX.WHITE, 0)]]);
    c.beginPath(); c.moveTo(7, 16); c.lineTo(2, 0); c.lineTo(42, 0); c.lineTo(37, 16); c.closePath(); c.fill();
    c.fillStyle = o.leak; c.fillRect(7, 14.5, 30, 3);
    // lid, tilted open a touch
    c.save(); c.translate(22, 14); c.rotate(-0.07); c.translate(-22, -14);
    c.fillStyle = lin(c, 0, 3, 0, 14, [[0, o.lid[0]], [1, o.lid[1]]]);
    c.beginPath(); c.roundRect(4, 3, 36, 11.5, [9, 9, 2, 2]); c.fill(); c.stroke();
    c.fillStyle = o.trim; c.fillRect(4.6, 11, 34.8, 2.2);
    c.fillStyle = o.trimL; c.fillRect(19, 3.6, 6, 10);
    c.strokeRect(19, 3, 6, 11.5);
    ellipse(c, 13, 7, 6, 1.6, rgba(HEX.WHITE, 0.28));
    c.restore();
    // body trim
    c.fillStyle = o.trim; c.fillRect(19, 17, 6, 16); c.fillRect(5.2, 28, 33.6, 2.6);
    c.strokeRect(19, 17, 6, 16);
    c.fillStyle = o.trimL; c.fillRect(20.5, 17.5, 1.6, 15);
    for (const x of [8, 36]) for (const y of [20, 31]) circle(c, x, y, 1.3, o.rivet);
    // rim light on the front edge
    c.strokeStyle = o.edge; c.lineWidth = 1; c.beginPath(); c.moveTo(6.5, 18.5); c.lineTo(37.5, 18.5); c.stroke();
    o.lock(c);
  });
}
function drawChests() {
  chest('chest_silver', {
    halo: rgba(HEX.FROST, 0.55), body: [HEX.SLATE_L, HEX.SLATE], lid: [HEX.SLATE_H, HEX.FROST_D],
    trim: HEX.FROST_L, trimL: HEX.FROST_H, rivet: HEX.FROST_H, edge: rgba(HEX.FROST_L, 0.8),
    leak: rgba(HEX.FROST_L, 0.95), leakMid: rgba(HEX.FROST, 0.35),
    lock: (c) => { glowDot(c, 22, 22, 9, rgba(HEX.OBJ, 0.9)); poly(c, [[22, 17.5], [26, 22], [22, 27], [18, 22]], HEX.FROST, OUT, 1.6); poly(c, [[22, 17.5], [26, 22], [22, 22]], HEX.FROST_H); },
  });
  chest('chest_gold', {
    halo: rgba(HEX.R_GOLD, 0.7), body: [HEX.R_BRONZE, HEX.R_GOLD_D], lid: [HEX.R_GOLD, HEX.R_BRONZE],
    trim: HEX.R_GOLD, trimL: HEX.R_LIGHT, rivet: HEX.R_LIGHT, edge: rgba(HEX.R_LIGHT, 0.9),
    leak: HEX.R_LIGHT, leakMid: rgba(HEX.R_GOLD, 0.45),
    lock: (c) => {
      glowDot(c, 22, 22, 11, HEX.R_GOLD);
      circle(c, 22, 22, 4.6, HEX.R_LIGHT, OUT, 1.8); circle(c, 22, 22, 2.4, HEX.R_BRONZE); circle(c, 21.2, 21.2, 0.9, HEX.WHITE);
      circle(c, 11, 24, 2, HEX.R_PINK, OUT, 1); circle(c, 33, 24, 2, HEX.R_GREEN, OUT, 1); circle(c, 22, 8.5, 1.8, HEX.FROST, OUT, 0.8);
    },
  });
  chest('chest_ascend', {
    halo: rgba(HEX.R_VIOLET, 0.8), body: [HEX.R_VIOLET, HEX.SLATE], lid: [HEX.R_VIOLET, HEX.VOID],
    trim: lin(actx, 0, 0, 44, 0, [[0, HEX.R_PINK], [0.25, HEX.R_GOLD], [0.5, HEX.R_GREEN], [0.75, HEX.FROST], [1, HEX.VOID]]),
    trimL: HEX.WHITE, rivet: HEX.WHITE, edge: rgba(HEX.SLATE_H, 0.9),
    leak: HEX.WHITE, leakMid: rgba(HEX.VOID, 0.6),
    lock: (c) => {
      glowDot(c, 22, 22, 13, HEX.R_PINK);
      poly(c, star(22, 22, 7.5, 3.2, 5, -Math.PI / 2), HEX.WHITE, OUT, 1.6);
      circle(c, 22, 22, 2, HEX.R_PINK);
      for (const [x, y, col] of [[10, 22, HEX.FROST], [34, 22, HEX.R_GOLD], [12, 9, HEX.R_GREEN], [32, 9, HEX.R_PINK]]) circle(c, x, y, 1.7, col, OUT, 0.8);
    },
  });
  // light pillar (tinted + additive): 48x256, white core fading at the edges and top
  make('chestbeam', 48, 256, (c) => {
    const t = document.createElement('canvas'); t.width = 48; t.height = 256;
    const k = t.getContext('2d');
    k.fillStyle = lin(k, 0, 0, 48, 0, [[0, rgba(HEX.WHITE, 0)], [0.3, rgba(HEX.WHITE, 0.35)], [0.5, HEX.WHITE], [0.7, rgba(HEX.WHITE, 0.35)], [1, rgba(HEX.WHITE, 0)]]);
    k.fillRect(0, 0, 48, 256);
    k.globalCompositeOperation = 'destination-in';
    k.fillStyle = lin(k, 0, 0, 0, 256, [[0, rgba(HEX.INK, 0)], [0.35, rgba(HEX.INK, 0.5)], [0.85, rgba(HEX.INK, 0.9)], [1, HEX.INK]]);
    k.fillRect(0, 0, 48, 256);
    c.drawImage(t, 0, 0);
  });
  make('chestring', 64, 64, (c) => {
    c.lineCap = 'round';
    for (const [lw, a] of [[11, 0.12], [7, 0.22], [4, 0.5], [1.8, 1]]) {
      c.strokeStyle = rgba(HEX.WHITE, a); c.lineWidth = lw;
      c.beginPath(); c.arc(32, 32, 26, 0, TAU); c.stroke();
    }
  });
}
function drawPickups() {
  gem('gem0', HEX.FROST_L, HEX.R_BLUE, HEX.FROST_D);
  gem('gem1', HEX.OBJ, HEX.R_GREEN, HEX.MOSS, 1, 1);
  gem('gem2', HEX.R_LIGHT, HEX.R_PINK, HEX.INK, 1, 2);
  gem('gem3', HEX.SLATE_H, HEX.R_VIOLET, HEX.SLATE, 1, 3);
  gem('gem4', HEX.R_LIGHT, HEX.R_GOLD, HEX.R_GOLD_D, 1.4, 4);
  make('heart', 28, 26, (c) => {
    glowDot(c, 14, 13, 14, rgba(HEX.R_PINK, 0.65));
    c.beginPath(); c.moveTo(14, 23); c.bezierCurveTo(-2, 12, 4, 0, 14, 7); c.bezierCurveTo(24, 0, 30, 12, 14, 23);
    c.fillStyle = radial(c, 11, 10, 14, [[0, HEX.R_PINK], [0.6, HEX.R_PINK], [1, HEX.R_PINK]]); c.fill();
    rim(c, rgba(HEX.WHITE, 0.85), HEX.INK, 2);
    ellipse(c, 9, 9, 3, 2, HEX.R_LIGHT);
  });
  make('magnet', 28, 28, (c) => {
    glowDot(c, 14, 14, 14, rgba(HEX.R_BLUE, 0.65));
    c.lineCap = 'butt'; c.lineWidth = 8; c.strokeStyle = OUT;
    c.beginPath(); c.arc(14, 13, 8, Math.PI, 0); c.lineTo(22, 22); c.moveTo(6, 13); c.lineTo(6, 22); c.stroke();
    c.lineWidth = 5; c.strokeStyle = HEX.R_BLUE;
    c.beginPath(); c.arc(14, 13, 8, Math.PI, 0); c.stroke();
    c.lineWidth = 1.2; c.strokeStyle = rgba(HEX.WHITE, 0.8); c.beginPath(); c.arc(14, 13, 9.4, Math.PI * 1.05, Math.PI * 1.7); c.stroke();
    c.lineWidth = 5; c.strokeStyle = HEX.FROST_H; c.beginPath(); c.moveTo(6, 13); c.lineTo(6, 22); c.moveTo(22, 13); c.lineTo(22, 22); c.stroke();
  });
  make('bomb', 30, 30, (c) => {
    glowDot(c, 15, 15, 15, rgba(HEX.R_GOLD, 0.7));
    const pts = star(15, 16, 13, 6, 8, -Math.PI / 2);
    poly(c, pts, HEX.R_GOLD);
    c.fillStyle = radial(c, 15, 16, 11, [[0, rgba(HEX.R_LIGHT, 0.8)], [1, rgba(HEX.WHITE, 0)]]); c.beginPath(); c.arc(15, 16, 11, 0, TAU); c.fill();
    poly(c, pts); rim(c, rgba(HEX.R_LIGHT, 0.9), HEX.R_GOLD_D, 2);
    circle(c, 15, 16, 5, HEX.R_LIGHT);
  });
  make('freeze', 30, 30, (c) => {
    glowDot(c, 15, 15, 15, rgba(HEX.FROST, 0.7));
    c.save(); c.translate(15, 15); c.strokeStyle = HEX.SLATE_D; c.lineWidth = 5.4; c.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 3; i++) {
        c.save(); c.rotate((i * Math.PI) / 3);
        c.beginPath(); c.moveTo(0, -11); c.lineTo(0, 11); c.moveTo(-4, -8); c.lineTo(0, -5); c.lineTo(4, -8); c.moveTo(-4, 8); c.lineTo(0, 5); c.lineTo(4, 8); c.stroke();
        c.restore();
      }
      c.strokeStyle = HEX.FROST_H; c.lineWidth = 2.4;
    }
    c.restore();
    glowDot(c, 15, 15, 5, rgba(HEX.WHITE, 0.9));
  });
  make('cinder', 18, 18, (c) => {
    glowDot(c, 9, 9, 9, rgba(HEX.R_BRONZE, 0.85));
    circle(c, 9, 9, 6, HEX.R_GOLD);
    c.beginPath(); c.arc(9, 9, 6, 0, TAU); rim(c, rgba(HEX.R_LIGHT, 0.9), HEX.R_GOLD_D, 1.5);
    poly(c, [[9, 4], [11.5, 9], [9, 14], [6.5, 9]], HEX.R_LIGHT);
  });
  make('flareorb', 28, 28, (c) => {
    glowDot(c, 14, 14, 14, rgba(HEX.R_PINK, 0.85));
    const pts = star(14, 14, 10, 4, 4, Math.PI / 4);
    poly(c, pts, HEX.WHITE);
    c.fillStyle = radial(c, 14, 14, 7, [[0, HEX.WHITE], [1, rgba(HEX.SLATE_H, 0)]]); c.beginPath(); c.arc(14, 14, 7, 0, TAU); c.fill();
    poly(c, pts); rim(c, rgba(HEX.WHITE, 0.9), HEX.SLATE, 1.5);
  });
  make('chest', 44, 38, (c) => {
    shadow(c, 22, 33, 20, 5);
    glowDot(c, 22, 18, 22, rgba(HEX.R_BRONZE, 0.4));
    c.fillStyle = HEX.R_BRONZE; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(5, 15, 34, 18, 3); c.fill(); c.stroke();
    c.fillStyle = HEX.R_BRONZE; c.beginPath(); c.roundRect(4, 6, 36, 12, [8, 8, 2, 2]); c.fill(); c.stroke();
    ellipse(c, 13, 10, 6, 1.6, rgba(HEX.BONE, 0.25));
    c.fillStyle = HEX.R_BRONZE; c.fillRect(19, 6, 6, 27); c.fillRect(4, 15, 36, 3);
    c.strokeRect(19, 6, 6, 27);
    for (const x of [8, 36]) circle(c, x, 25, 1.2, HEX.SAND);
    circle(c, 22, 19, 3.5, HEX.SAND, OUT, 1.5);
  });
  drawChests();
}

// ---------- characters ----------
// STEP (-1, 0, 1) poses the legs for the walk cycle frames
let STEP = 0;
// Each Bearer gets an idle frame plus two stepping frames (_s1, _s2)
function makeChar(name, draw) {
  for (const [suffix, st] of [['', 0], ['_s1', 1], ['_s2', -1]]) {
    STEP = st;
    make(name + suffix, 64, 64, (c) => { c.translate(0, st ? -1 : 0); draw(c); });
  }
  STEP = 0;
}
// Bearers are drawn chibi: oversized heads, big glossy eyes, a strong silhouette and one signature prop each.
function bigEye(c, x, y, iris, rx = 3.6, ry = 4.6) {
  ellipse(c, x, y, rx, ry, HEX.WHITE, OUT, 1.6);
  ellipse(c, x + 0.4, y + 0.7, rx * 0.72, ry * 0.78, iris);
  circle(c, x + 0.4, y + 1, rx * 0.36, HEX.INK);
  circle(c, x - 0.9, y - 1.5, 1.3, HEX.WHITE);
}
function smile(c, x, y, w, col = OUT) {
  c.strokeStyle = col; c.lineWidth = 1.8; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, w, 0.25, Math.PI - 0.25); c.stroke();
}
function blush(c, x, y) { ellipse(c, x, y, 3.2, 2, rgba(HEX.CRIMSON, 0.55)); }
// short chibi legs with boots
function boots(c, cx, col, boot) {
  const l = STEP * 3;
  for (const [dx, lift] of [[-6, Math.max(0, l)], [2, Math.max(0, -l)]]) {
    c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.roundRect(cx + dx + STEP, 49 - lift, 6, 8, 2); c.fill(); c.stroke();
    c.fillStyle = boot; c.beginPath(); c.roundRect(cx + dx - 1 + STEP, 55 - lift, 8, 4, 2); c.fill(); c.stroke();
  }
}
function drawCharacters() {
  // Kael — Ashen Warden: grey hood, big amber eyes, trailing ember-orange scarf, lantern holding the last Ember
  makeChar('warden', (c) => {
    shadow(c, 32, 59, 17, 5);
    boots(c, 32, HEX.SLATE_D, HEX.SLATE_D);
    // scarf tail streams behind, swaying with the stride
    c.fillStyle = HEX.EMBER_D; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.moveTo(24, 36); c.quadraticCurveTo(10, 38 + STEP * 2, 4, 46 - STEP * 2); c.lineTo(9, 50 - STEP * 2); c.quadraticCurveTo(16, 44, 26, 42); c.closePath(); c.fill(); c.stroke();
    poly(c, [[19, 50], [21, 33], [43, 33], [45, 50]], HEX.SLATE_L, OUT, 2.5);
    poly(c, [[26, 50], [27, 36], [37, 36], [38, 50]], HEX.SLATE_L);
    c.fillStyle = HEX.EMBER; c.beginPath(); c.roundRect(22, 33, 20, 6, 3); c.fill(); c.stroke(); // scarf wrap
    // big hood
    c.beginPath(); c.moveTo(16, 30); c.bezierCurveTo(14, 8, 28, 3, 32, 3); c.bezierCurveTo(36, 3, 50, 8, 48, 30); c.quadraticCurveTo(32, 36, 16, 30);
    c.fillStyle = lin(c, 0, 3, 0, 32, [[0, HEX.SLATE_L], [1, HEX.SLATE]]); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    ellipse(c, 32, 21, 11.5, 9.5, HEX.INK);
    bigEye(c, 27.5, 21, HEX.EMBER); bigEye(c, 36.5, 21, HEX.EMBER);
    glowDot(c, 27.5, 21, 7, rgba(HEX.EMBER, 0.35)); glowDot(c, 36.5, 21, 7, rgba(HEX.EMBER, 0.35));
    // lantern
    c.strokeStyle = HEX.SLATE_D; c.lineWidth = 2; c.beginPath(); c.moveTo(46, 38); c.lineTo(51, 42); c.stroke();
    glowDot(c, 52, 49, 15, rgba(HEX.EMBER, 0.9));
    c.fillStyle = HEX.EMBER_L; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.roundRect(47, 43, 10, 12, 3); c.fill(); c.stroke();
    circle(c, 52, 49, 3.4, HEX.EMBER_H);
    poly(c, [[52, 36], [55, 42], [49, 42]], HEX.EMBER);
  });
  // Ysolde — Rime Oracle: long frost-white hair, crystal tiara, star-bright eyes, floating-orb staff
  makeChar('oracle', (c) => {
    shadow(c, 32, 59, 16, 5);
    // long hair behind
    c.fillStyle = HEX.FROST_H; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(16, 18); c.bezierCurveTo(8, 34, 12, 48, 20 + STEP * 2, 52); c.lineTo(44 + STEP * 2, 52); c.bezierCurveTo(52, 48, 56, 34, 48, 18); c.closePath(); c.fill(); c.stroke();
    boots(c, 32, HEX.FROST_D, HEX.FROST_D);
    poly(c, [[18 + STEP * 2, 54], [22, 33], [42, 33], [46 + STEP * 2, 54]], HEX.R_BLUE, OUT, 2.5);
    poly(c, [[26 + STEP, 54], [28, 36], [36, 36], [38 + STEP, 54]], HEX.FROST_L);
    c.fillStyle = HEX.FROST; c.beginPath(); c.roundRect(24, 34, 16, 4, 2); c.fill();
    // head
    circle(c, 32, 21, 13, HEX.BONE, OUT, 2.5);
    c.fillStyle = HEX.FROST_H; c.beginPath(); c.moveTo(19, 22); c.bezierCurveTo(18, 6, 46, 6, 45, 22); c.quadraticCurveTo(40, 12, 32, 13); c.quadraticCurveTo(24, 12, 19, 22);
    c.fill(); c.stroke();
    bigEye(c, 27, 23, HEX.R_BLUE, 3.4, 4.4); bigEye(c, 37, 23, HEX.R_BLUE, 3.4, 4.4);
    blush(c, 22.5, 28); blush(c, 41.5, 28); smile(c, 32, 28.5, 2.2);
    // tiara
    poly(c, [[22, 11], [25, 0], [29, 8], [32, -2], [35, 8], [39, 0], [42, 11]], HEX.FROST_L, OUT, 2);
    glowDot(c, 32, 5, 7, rgba(HEX.FROST_L, 0.8));
    // staff with floating orb
    c.strokeStyle = HEX.FROST_H; c.lineWidth = 3; c.beginPath(); c.moveTo(52, 56); c.lineTo(53, 28); c.stroke();
    glowDot(c, 53, 22 + STEP, 13, rgba(HEX.FROST, 0.9));
    poly(c, [[53, 14 + STEP], [57, 22 + STEP], [53, 30 + STEP], [49, 22 + STEP]], HEX.FROST_H, HEX.FROST_D, 1.5);
  });
  // Pip — Clockwork Tinker: tiny, spiky ginger hair, huge goggles, gap-toothed grin, spinning-gear backpack
  makeChar('tinker', (c) => {
    shadow(c, 32, 59, 16, 5);
    // brass backpack + gear + antenna
    c.fillStyle = HEX.R_BRONZE; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(38, 32, 15, 18, 4); c.fill(); c.stroke();
    c.save(); c.translate(45.5, 41); c.rotate(STEP * 0.5);
    c.fillStyle = HEX.EMBER_L; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.lineTo(Math.cos(a) * (i % 2 ? 4 : 6), Math.sin(a) * (i % 2 ? 4 : 6)); } c.closePath(); c.fill(); c.lineWidth = 1.2; c.stroke(); c.restore();
    c.strokeStyle = HEX.SLATE_L; c.lineWidth = 2; c.beginPath(); c.moveTo(48, 32); c.lineTo(50, 18); c.stroke();
    glowDot(c, 50, 17, 7, rgba(HEX.OBJ, 0.95));
    boots(c, 30, HEX.WOOD, HEX.R_GOLD_D);
    // overalls
    poly(c, [[19, 51], [20, 34], [42, 34], [43, 51]], HEX.FROST_D, OUT, 2.5);
    c.fillStyle = HEX.EMBER_H; c.beginPath(); c.roundRect(24, 34, 14, 9, 3); c.fill(); c.stroke();
    circle(c, 31, 40, 1.6, HEX.R_BRONZE);
    // head
    circle(c, 30, 22, 13.5, HEX.SKIN, OUT, 2.5);
    poly(c, [[16, 18], [14, 8], [21, 12], [22, 2], [28, 9], [32, 0], [35, 9], [41, 3], [41, 12], [47, 10], [44, 20], [30, 12]], HEX.EMBER_D, OUT, 2);
    // goggles over eyes
    c.fillStyle = HEX.WOOD; c.fillRect(16, 19, 28, 4);
    circle(c, 24, 23, 7, HEX.SLATE_D, OUT, 2); circle(c, 37, 23, 7, HEX.SLATE_D, OUT, 2);
    circle(c, 24, 23, 5, HEX.OBJ); circle(c, 37, 23, 5, HEX.OBJ);
    circle(c, 25, 24, 2.3, HEX.SLATE_D); circle(c, 38, 24, 2.3, HEX.SLATE_D);
    circle(c, 22.6, 21, 1.6, HEX.WHITE); circle(c, 35.6, 21, 1.6, HEX.WHITE);
    // grin with a gap
    c.fillStyle = HEX.WOOD_D; c.beginPath(); c.arc(30.5, 31, 4.6, 0.1, Math.PI - 0.1); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    c.fillStyle = HEX.WHITE; c.fillRect(28, 28.4, 2.6, 2.6); c.fillRect(32, 28.4, 2.6, 2.6);
    // wrench
    c.save(); c.translate(11, 44); c.rotate(-0.5 + STEP * 0.2);
    c.fillStyle = HEX.SLATE_H; c.beginPath(); c.roundRect(-2, -12, 4, 20, 2); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    c.beginPath(); c.arc(0, -13, 5, 0.5, TAU - 0.5); c.stroke(); c.restore();
  });
  // Grahm — Blood Reaver: huge pauldrons, horned helm, toothy war-grin, crescent axe over the shoulder
  makeChar('reaver', (c) => {
    shadow(c, 32, 59, 19, 5);
    // axe behind
    c.strokeStyle = HEX.WOOD; c.lineWidth = 3.5; c.beginPath(); c.moveTo(50, 56); c.lineTo(54 + STEP, 8); c.stroke();
    c.beginPath(); c.moveTo(54 + STEP, 6); c.quadraticCurveTo(68, 16, 58, 32); c.quadraticCurveTo(61, 20, 53 + STEP, 17); c.closePath();
    c.fillStyle = HEX.FROST_H; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    boots(c, 32, HEX.WOOD_D, HEX.WOOD_D);
    poly(c, [[16, 51], [18, 33], [46, 33], [48, 51]], HEX.CRIMSON, OUT, 2.5);
    poly(c, [[25, 51], [27, 36], [37, 36], [39, 51]], HEX.CRIMSON);
    c.fillStyle = HEX.WOOD_D; c.fillRect(17, 45, 30, 4); circle(c, 32, 47, 3, HEX.EMBER_L, OUT, 1.5);
    // pauldrons
    for (const x of [14, 50]) { circle(c, x, 33, 8, HEX.SLATE_L, OUT, 2.5); circle(c, x - 1.5, 31, 3, HEX.SLATE_H); poly(c, [[x - 3, 26], [x, 17], [x + 3, 26]], HEX.BONE, OUT, 1.5); }
    // helm
    c.fillStyle = HEX.SLATE_L; c.beginPath(); c.roundRect(17, 6, 30, 28, 11); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
    poly(c, [[19, 14], [6, 0], [10, 17]], HEX.BONE, OUT, 2); poly(c, [[45, 14], [58, 0], [54, 17]], HEX.BONE, OUT, 2);
    c.fillStyle = HEX.INK; c.beginPath(); c.roundRect(21, 15, 22, 11, 4); c.fill();
    // angry brows + glowing eyes + teeth
    c.strokeStyle = HEX.INK; c.lineWidth = 3; c.beginPath(); c.moveTo(22, 13); c.lineTo(30, 17); c.moveTo(42, 13); c.lineTo(34, 17); c.stroke();
    ellipse(c, 27, 21, 2.8, 2.4, HEX.EMBER_D); ellipse(c, 37, 21, 2.8, 2.4, HEX.EMBER_D);
    circle(c, 26.4, 20.4, 0.9, HEX.WHITE); circle(c, 36.4, 20.4, 0.9, HEX.WHITE);
    c.fillStyle = HEX.R_LIGHT; c.beginPath(); c.roundRect(24, 28, 16, 5, 2); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1; c.beginPath(); for (let x = 27; x < 40; x += 3.2) { c.moveTo(x, 28); c.lineTo(x, 33); } c.stroke();
  });
  // Brannoc — The Bellwright: round, jolly, braided copper beard, great bronze bell on his back, big hammer
  makeChar('bellwright', (c) => {
    shadow(c, 32, 59, 20, 5);
    // bell behind, swings with the stride
    c.save(); c.translate(44, 26); c.rotate(STEP * 0.1);
    c.beginPath(); c.moveTo(-9, -12); c.quadraticCurveTo(-11, 6, -16, 13); c.lineTo(16, 13); c.quadraticCurveTo(11, 6, 9, -12); c.quadraticCurveTo(0, -19, -9, -12);
    c.fillStyle = lin(c, -16, 0, 16, 0, [[0, HEX.R_GOLD_D], [0.45, HEX.EMBER_L], [1, HEX.R_GOLD_D]]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = HEX.EMBER_L; c.fillRect(-15, 9, 30, 3);
    circle(c, 0, 16, 3.2, HEX.WOOD, OUT, 1.5);
    c.restore();
    boots(c, 30, HEX.WOOD_D, HEX.WOOD_D);
    // barrel body + apron
    c.fillStyle = HEX.WOOD; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(15, 31, 32, 21, 9); c.fill(); c.stroke();
    poly(c, [[20, 34], [42, 34], [40, 52], [22, 52]], HEX.R_GOLD_D);
    c.fillStyle = HEX.R_BRONZE; c.fillRect(20, 41, 22, 3);
    // head: broad, bushy brows, big copper beard
    circle(c, 31, 20, 14.5, HEX.SKIN, OUT, 2.5);
    c.fillStyle = HEX.WOOD_D; c.beginPath(); c.roundRect(16, 5, 30, 8, 4); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(17, 24); c.quadraticCurveTo(14, 42, 31, 46); c.quadraticCurveTo(48, 42, 45, 24); c.quadraticCurveTo(31, 33, 17, 24);
    c.fillStyle = HEX.EMBER_D; c.fill(); c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = HEX.EMBER_D; c.lineWidth = 1.4; c.beginPath(); c.moveTo(25, 33); c.lineTo(25, 42); c.moveTo(31, 34); c.lineTo(31, 44); c.moveTo(37, 33); c.lineTo(37, 42); c.stroke();
    c.strokeStyle = HEX.EMBER_D; c.lineWidth = 3.5; c.beginPath(); c.moveTo(22, 15); c.lineTo(29, 17); c.moveTo(40, 15); c.lineTo(33, 17); c.stroke();
    bigEye(c, 26, 20, HEX.EMBER_L, 3, 3.8); bigEye(c, 36, 20, HEX.EMBER_L, 3, 3.8);
    ellipse(c, 31, 24.5, 3, 2.3, HEX.SKIN_D, OUT, 1.4); smile(c, 31, 26.5, 4);
    // hammer
    c.strokeStyle = HEX.WOOD; c.lineWidth = 3.5; c.beginPath(); c.moveTo(13, 49); c.lineTo(9, 32); c.stroke();
    c.fillStyle = HEX.SLATE_H; c.beginPath(); c.roundRect(2, 26, 15, 9, 3); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  });
  // Lune — Moon Dancer: violet ponytail, moon circlet, a cheeky wink, long fluttering scarf, poised stance
  makeChar('dancer', (c) => {
    shadow(c, 32, 59, 15, 5);
    // ponytail + scarf trail behind
    c.fillStyle = HEX.R_VIOLET; c.strokeStyle = OUT; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(44, 10); c.bezierCurveTo(60, 8 + STEP * 2, 60, 30, 52, 38 - STEP * 3); c.bezierCurveTo(54, 26, 52, 18, 44, 18); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = HEX.VOID;
    c.beginPath(); c.moveTo(24, 36); c.quadraticCurveTo(8, 36 - STEP * 2, 2, 50 + STEP * 2); c.lineTo(8, 54 + STEP * 2); c.quadraticCurveTo(14, 44, 26, 42); c.closePath(); c.fill(); c.stroke();
    boots(c, 32, HEX.SLATE_D, HEX.MOON);
    poly(c, [[22, 51], [24, 33], [40, 33], [42, 51]], HEX.FROST_D, OUT, 2.5);
    poly(c, [[28, 51], [29, 36], [35, 36], [36, 51]], HEX.FROST_H);
    c.fillStyle = HEX.MOON; c.beginPath(); c.roundRect(23, 33, 18, 5, 2.5); c.fill(); c.stroke();
    // head
    circle(c, 32, 21, 13, HEX.BONE, OUT, 2.5);
    c.fillStyle = HEX.R_VIOLET; c.beginPath(); c.moveTo(18, 22); c.bezierCurveTo(16, 4, 48, 4, 46, 22); c.quadraticCurveTo(42, 12, 36, 14); c.lineTo(32, 9); c.lineTo(28, 15); c.quadraticCurveTo(22, 12, 18, 22);
    c.fill(); c.lineWidth = 2.5; c.stroke();
    // winking eye + open eye
    bigEye(c, 37, 23, HEX.VOID, 3.4, 4.4);
    c.strokeStyle = OUT; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.arc(27, 23, 3.2, 0.15, Math.PI - 0.15, true); c.stroke();
    blush(c, 22, 28); blush(c, 42, 28);
    c.fillStyle = HEX.CRIMSON; c.beginPath(); c.arc(33, 28.4, 3, 0.1, Math.PI - 0.1); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke();
    // moon circlet
    glowDot(c, 32, 9, 8, rgba(HEX.SLATE_H, 0.9));
    c.fillStyle = HEX.WHITE; c.beginPath(); c.arc(32, 9, 4.6, 0, TAU); c.fill();
    c.fillStyle = HEX.R_VIOLET; c.beginPath(); c.arc(33.8, 8, 3.8, 0, TAU); c.fill();
    // glaive
    c.strokeStyle = HEX.SLATE_H; c.lineWidth = 2.4; c.beginPath(); c.arc(12, 44, 7, -1.2, 1.6 + STEP * 0.2); c.stroke();
  });
  // Sable — Gloam Hunter: slim, hooded teal cloak with a fur collar, rakish scarf, sharp amber eyes, crossbow + quiver
  makeChar('hunter', (c) => {
    shadow(c, 32, 59, 15, 5);
    // quiver behind the shoulder
    c.save(); c.translate(46, 32); c.rotate(0.35);
    c.fillStyle = HEX.WOOD; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.roundRect(-4.5, -4, 9, 20, 3); c.fill(); c.stroke();
    c.fillStyle = HEX.SAND; c.fillRect(-4, 5, 8, 2);
    for (const [dx, col] of [[-2.5, HEX.EMBER_D], [0, HEX.R_LIGHT], [2.5, HEX.EMBER_D]]) poly(c, [[dx, -4], [dx + 2, -9], [dx - 2, -9]], col, OUT, 1.2);
    c.restore();
    // scarf tail
    c.fillStyle = HEX.EMBER_D; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.moveTo(24, 35); c.quadraticCurveTo(10, 36 + STEP * 2, 3, 43 - STEP * 3); c.lineTo(9, 49 - STEP * 2); c.quadraticCurveTo(15, 42, 27, 41); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = HEX.SKIN; c.lineWidth = 1.2; c.beginPath(); c.moveTo(8, 42 - STEP); c.lineTo(11, 45 - STEP); c.stroke();
    boots(c, 32, HEX.MOSS_D, HEX.MOSS_D);
    // slim cloak
    poly(c, [[21, 52], [24, 33], [40, 33], [43, 52]], HEX.MOSS, OUT, 2.5);
    poly(c, [[27, 52], [28, 36], [36, 36], [37, 52]], HEX.OBJ_D);
    c.strokeStyle = HEX.MOSS_D; c.lineWidth = 1.4; c.beginPath(); c.moveTo(25, 48); c.lineTo(25, 40); c.moveTo(39, 48); c.lineTo(39, 40); c.stroke();
    c.fillStyle = HEX.WOOD; c.fillRect(22, 44, 20, 3); circle(c, 32, 45.5, 2, HEX.EMBER_L, OUT, 1);
    // hood
    c.beginPath(); c.moveTo(17, 30); c.bezierCurveTo(14, 8, 26, 2, 32, 2); c.bezierCurveTo(38, 2, 50, 8, 47, 30); c.quadraticCurveTo(32, 36, 17, 30);
    c.fillStyle = lin(c, 0, 2, 0, 32, [[0, HEX.OBJ_D], [1, HEX.MOSS]]); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    poly(c, [[32, 2], [36, 0], [38, 6]], HEX.OBJ_D, OUT, 1.5);
    // face in hood shadow
    ellipse(c, 32, 22, 11, 9.5, HEX.MOSS_D);
    ellipse(c, 32, 25, 8.5, 6.5, HEX.SKIN);
    ellipse(c, 32, 17, 11, 4, rgba(HEX.MOSS_D, 0.85));
    bigEye(c, 27.8, 22, HEX.EMBER, 3.1, 3.4); bigEye(c, 36.2, 22, HEX.EMBER, 3.1, 3.4);
    c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(23.5, 17.5); c.lineTo(30, 19.5); c.moveTo(40.5, 17.5); c.lineTo(34, 19.5); c.stroke();
    c.beginPath(); c.moveTo(29.5, 29); c.quadraticCurveTo(33, 30.2, 36, 28); c.stroke();
    glowDot(c, 27.8, 22, 6, rgba(HEX.EMBER, 0.3)); glowDot(c, 36.2, 22, 6, rgba(HEX.EMBER, 0.3));
    // fur collar + scarf wrap
    c.fillStyle = HEX.BONE; c.strokeStyle = OUT; c.lineWidth = 1.8;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(21 + i * 4.4, 33.5 + (i % 2) * 1.2, 4, 0, TAU); c.fill(); c.stroke(); }
    c.fillStyle = HEX.EMBER_D; c.beginPath(); c.roundRect(23, 32, 12, 4.5, 2); c.fill(); c.stroke();
    // crossbow held at the front
    c.save(); c.translate(48, 44); c.rotate(-0.25 + STEP * 0.06);
    c.fillStyle = HEX.WOOD; c.strokeStyle = OUT; c.lineWidth = 1.8;
    c.beginPath(); c.roundRect(-3, -9, 5, 20, 2); c.fill(); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-10, -4); c.quadraticCurveTo(-1, -12, 9, -5); c.stroke();
    c.strokeStyle = HEX.SAND; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-10, -4); c.quadraticCurveTo(-1, -12, 9, -5); c.stroke();
    c.strokeStyle = HEX.R_LIGHT; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-10, -4); c.lineTo(-0.5, 2); c.lineTo(9, -5); c.stroke();
    poly(c, [[-0.5, -10], [1, -14], [2.5, -10]], HEX.FROST_H, OUT, 1);
    c.restore();
    circle(c, 46, 47, 3, HEX.SKIN, OUT, 1.6);
  });
  // Orin — Hearthkeeper: broad, stocky, thick gold-brown coat, kindly bearded face, pole lantern and an iron-and-ember shield
  makeChar('hearthkeeper', (c) => {
    shadow(c, 32, 59, 21, 5);
    boots(c, 32, HEX.WOOD_D, HEX.WOOD_D);
    // pole + great lantern (left hand)
    c.strokeStyle = OUT; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(9, 57); c.lineTo(10, 16); c.stroke();
    c.strokeStyle = HEX.WOOD; c.lineWidth = 2.6; c.beginPath(); c.moveTo(9, 57); c.lineTo(10, 16); c.stroke();
    glowDot(c, 11, 11, 17, rgba(HEX.EMBER, 0.85));
    c.fillStyle = HEX.WOOD_L; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.roundRect(4, 4, 14, 15, 3); c.fill(); c.stroke();
    ellipse(c, 11, 12, 4.6, 5.6, HEX.EMBER_H);
    glowDot(c, 11, 12, 5, rgba(HEX.WHITE, 0.95));
    c.strokeStyle = HEX.EMBER_L; c.lineWidth = 1.6; c.beginPath(); c.moveTo(7, 5); c.lineTo(7, 18); c.moveTo(15, 5); c.lineTo(15, 18); c.stroke();
    poly(c, [[4, 4], [11, -1], [18, 4]], HEX.WOOD_L, OUT, 1.8); circle(c, 11, -1, 1.6, HEX.EMBER_L, OUT, 1);
    // stocky coat
    c.fillStyle = lin(c, 0, 30, 0, 54, [[0, HEX.R_BRONZE], [1, HEX.R_GOLD_D]]); c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(13, 30, 38, 24, 10); c.fill(); c.stroke();
    poly(c, [[28, 32], [36, 32], [38, 54], [26, 54]], HEX.EMBER_L);
    c.strokeStyle = OUT; c.lineWidth = 1.4; c.beginPath(); c.moveTo(32, 33); c.lineTo(32, 54); c.stroke();
    for (const y of [38, 44, 50]) circle(c, 29, y, 1.6, HEX.WOOD, OUT, 0.8);
    c.fillStyle = HEX.WOOD; c.fillRect(14, 45, 36, 4); c.fillStyle = HEX.EMBER_L; c.fillRect(29, 44.5, 6, 5); // belt + buckle
    // fur-trimmed collar
    c.fillStyle = HEX.BONE; c.strokeStyle = OUT; c.lineWidth = 1.8;
    for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(17 + i * 5, 32 + (i % 2) * 1.2, 4.2, 0, TAU); c.fill(); c.stroke(); }
    // head
    circle(c, 32, 19, 14.5, HEX.SKIN, OUT, 2.5);
    c.fillStyle = HEX.R_GOLD_D; c.beginPath(); c.moveTo(17, 17); c.bezierCurveTo(14, 2, 50, 2, 47, 17); c.quadraticCurveTo(40, 8, 32, 10); c.quadraticCurveTo(24, 8, 17, 17);
    c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
    // big silver-brown beard
    c.beginPath(); c.moveTo(18, 24); c.quadraticCurveTo(14, 42, 32, 46); c.quadraticCurveTo(50, 42, 46, 24); c.quadraticCurveTo(32, 32, 18, 24);
    c.fillStyle = HEX.BONE; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = HEX.SAND; c.lineWidth = 1.3; c.beginPath(); c.moveTo(26, 34); c.lineTo(26, 41); c.moveTo(32, 36); c.lineTo(32, 43); c.moveTo(38, 34); c.lineTo(38, 41); c.stroke();
    c.strokeStyle = HEX.WOOD_L; c.lineWidth = 3.4; c.beginPath(); c.moveTo(22, 14); c.quadraticCurveTo(26, 13, 29.5, 15.5); c.moveTo(42, 14); c.quadraticCurveTo(38, 13, 34.5, 15.5); c.stroke();
    bigEye(c, 26.5, 19.5, HEX.R_GOLD_D, 3, 3.8); bigEye(c, 37.5, 19.5, HEX.R_GOLD_D, 3, 3.8);
    ellipse(c, 32, 25, 3.4, 2.6, HEX.SKIN_D, OUT, 1.4);
    blush(c, 21.5, 25); blush(c, 42.5, 25);
    smile(c, 32, 29.5, 3.6);
    // ember shield (right hand)
    c.save(); c.translate(52, 41 + STEP * 0.5);
    glowDot(c, 0, 0, 16, rgba(HEX.EMBER, 0.6));
    circle(c, 0, 0, 11, lin(c, -10, -10, 10, 10, [[0, HEX.SLATE_H], [1, HEX.SLATE]]), OUT, 2.5);
    circle(c, 0, 0, 7.5, HEX.SLATE_D, OUT, 1.4);
    glowDot(c, 0, 0, 7, HEX.EMBER); circle(c, 0, 0, 3, HEX.EMBER_H);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; circle(c, Math.cos(a) * 9.2, Math.sin(a) * 9.2, 0.9, HEX.FROST_H); }
    c.restore();
  });
}

// ---------- enemies ----------
function drawEnemies() {
  // Gloomling — oily shadow blob with glowing eyes
  for (const f of [0, 1]) make('gloomling' + f, 40, 40, (c) => {
    shadow(c, 20, 35, 14, 4);
    const sq = f ? 1.08 : 1, st = f ? 0.92 : 1;
    c.save(); c.translate(20, 34); c.scale(sq, st);
    c.beginPath(); c.moveTo(-14, 0);
    c.bezierCurveTo(-16, -18, -8, -26, 0, -26); c.bezierCurveTo(8, -26, 16, -18, 14, 0);
    c.quadraticCurveTo(10, -3, 7, 0); c.quadraticCurveTo(3, -4, 0, 0); c.quadraticCurveTo(-3, -4, -7, 0); c.quadraticCurveTo(-10, -3, -14, 0);
    c.fillStyle = lin(c, 0, -26, 0, 0, [[0, HEX.GLOOM], [1, HEX.GLOOM_D]]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    ellipse(c, -4, -19, 4, 2.5, rgba(HEX.WHITE, 0.18));
    c.restore();
    eye(c, 15, 22 + f, 2.3, HEX.SPIRIT_L); eye(c, 25, 22 + f, 2.3, HEX.SPIRIT_L);
  });
  // Dusk Moth — fast, fluttering
  for (const f of [0, 1]) make('moth' + f, 40, 40, (c) => {
    shadow(c, 20, 36, 10 * SHADOW.floatWidth, 3 * SHADOW.floatWidth, SHADOW.floatAlpha);
    c.save(); c.translate(20, 19);
    const wy = f ? 0.55 : 1;
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, wy);
      c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(18, -20, 19, -4); c.quadraticCurveTo(16, 6, 0, 3);
      c.fillStyle = HEX.ROSE; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      circle(c, 11, -6, 3, HEX.ROSE_L);
      c.beginPath(); c.moveTo(0, 3); c.quadraticCurveTo(13, 6, 12, 15); c.quadraticCurveTo(5, 12, 0, 5);
      c.fillStyle = HEX.ROSE; c.fill(); c.stroke();
      c.restore();
    }
    ellipse(c, 0, 0, 4, 9, HEX.ROSE_D, OUT, 2);
    eye(c, -2, -5, 1.4, HEX.SAND); eye(c, 2, -5, 1.4, HEX.SAND);
    c.restore();
  });
  // Husk — lumbering stone hulk with ember cracks
  for (const f of [0, 1]) make('husk' + f, 60, 60, (c) => {
    shadow(c, 30, 54, 22, 6);
    const lift = f ? -2 : 0;
    c.fillStyle = HEX.HULK_D; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(15, 44 + lift, 10, 11, 3); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(35, 44 - lift, 10, 11, 3); c.fill(); c.stroke();
    poly(c, [[10, 44], [8, 22], [18, 10], [42, 10], [52, 22], [50, 44]], HEX.HULK, OUT, 3);
    poly(c, [[14, 40], [13, 24], [20, 15], [40, 15], [46, 24], [46, 40]], HEX.HULK_L);
    c.strokeStyle = HEX.HFIRE; c.lineWidth = 2;
    c.beginPath(); c.moveTo(20, 30); c.lineTo(26, 36); c.lineTo(24, 42); c.moveTo(38, 22); c.lineTo(34, 30); c.lineTo(40, 36); c.stroke();
    c.fillStyle = HEX.HULK; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(3, 22 - lift, 10, 20, 4); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(47, 22 + lift, 10, 20, 4); c.fill(); c.stroke();
    c.fillStyle = HEX.INK; c.fillRect(21, 19, 18, 6);
    eye(c, 26, 22, 2, HEX.HFIRE); eye(c, 34, 22, 2, HEX.HFIRE);
  });
  // Wraith — hooded spirit trailing a ragged tail
  for (const f of [0, 1]) make('wraith' + f, 48, 52, (c) => {
    shadow(c, 24, 49, 12 * SHADOW.floatWidth, 4 * SHADOW.floatWidth, SHADOW.floatAlpha);
    c.save(); c.translate(24, 0);
    const w = f ? 3 : -3;
    c.beginPath(); c.moveTo(-14, 20); c.quadraticCurveTo(-16, 4, 0, 3); c.quadraticCurveTo(16, 4, 14, 20);
    c.lineTo(12, 38); c.lineTo(6 + w, 34); c.lineTo(2, 48); c.lineTo(-3 + w, 36); c.lineTo(-9, 44); c.lineTo(-12, 34);
    c.closePath();
    c.fillStyle = lin(c, 0, 3, 0, 48, [[0, rgba(HEX.SPIRIT, 0.95)], [1, rgba(HEX.SPIRIT_D, 0.25)]]); c.fill();
    c.lineWidth = 2; c.strokeStyle = HEX.INK; c.stroke();
    ellipse(c, 0, 16, 9, 8, HEX.INK);
    eye(c, -4, 16, 1.8, HEX.SPIRIT_L); eye(c, 4, 16, 1.8, HEX.SPIRIT_L);
    c.restore();
  });
  // Bloater (splitter) — pustule sac that bursts into broodlings
  make('splitter0', 48, 48, (c) => {
    shadow(c, 24, 43, 16, 4);
    circle(c, 24, 25, 17, lin(c, 0, 8, 0, 42, [[0, HEX.BOG_L], [1, HEX.BOG_D]]), OUT, 2.5);
    circle(c, 15, 18, 5, HEX.BOG_L, OUT, 1.5); circle(c, 32, 31, 4, HEX.BOG_L, OUT, 1.5); circle(c, 30, 15, 3, HEX.BOG_L, OUT, 1.5);
    eye(c, 20, 26, 2.4, HEX.HEYE); eye(c, 28, 24, 1.8, HEX.HEYE);
  });
  make('splitter1', 48, 48, (c) => {
    shadow(c, 24, 43, 17, 4);
    ellipse(c, 24, 26, 18, 16, lin(c, 0, 8, 0, 42, [[0, HEX.BOG_L], [1, HEX.BOG_D]]), OUT, 2.5);
    circle(c, 15, 19, 5.5, HEX.BOG_L, OUT, 1.5); circle(c, 32, 32, 4.5, HEX.BOG_L, OUT, 1.5); circle(c, 30, 16, 3.2, HEX.BOG_L, OUT, 1.5);
    eye(c, 20, 27, 2.4, HEX.HEYE); eye(c, 28, 25, 1.8, HEX.HEYE);
  });
  for (const f of [0, 1]) make('broodling' + f, 24, 24, (c) => {
    shadow(c, 12, 21, 8, 2.5);
    c.strokeStyle = OUT; c.lineWidth = 1.5;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(12, 14); c.lineTo(12 + s * 10, 12 + (f ? 6 : 2)); c.stroke(); }
    circle(c, 12, 13, 7, HEX.BOG, OUT, 2);
    eye(c, 10, 12, 1.4, HEX.HEYE); eye(c, 14, 12, 1.4, HEX.HEYE);
  });
  // Ram Beetle (charger)
  for (const f of [0, 1]) make('beetle' + f, 52, 48, (c) => {
    shadow(c, 26, 43, 19, 5);
    c.strokeStyle = OUT; c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(26 + s * 8, 26 + i * 6); c.lineTo(26 + s * 19, 30 + i * 6 + ((i + f) % 2 ? 3 : -2)); c.stroke();
    }
    ellipse(c, 26, 28, 15, 14, lin(c, 0, 14, 0, 42, [[0, HEX.ROSE], [1, HEX.HEYE_D]]), OUT, 2.5);
    c.beginPath(); c.moveTo(26, 14); c.lineTo(26, 42); c.stroke();
    poly(c, [[20, 16], [26, 0], [32, 16]], HEX.BONE, OUT, 2);
    ellipse(c, 21, 22, 3, 5, rgba(HEX.WHITE, 0.25));
    eye(c, 21, 15, 1.6, HEX.HGLARE); eye(c, 31, 15, 1.6, HEX.HGLARE);
  });
  // Spitter — bloated toad that lobs venom orbs
  for (const f of [0, 1]) make('spitter' + f, 46, 44, (c) => {
    shadow(c, 23, 39, 17, 4);
    ellipse(c, 23, 27, 17, 13 - f, lin(c, 0, 14, 0, 40, [[0, HEX.SPIRIT], [1, HEX.SPIRIT_D]]), OUT, 2.5);
    ellipse(c, 23, 31, 10, 6, HEX.SPIRIT_L);
    ellipse(c, 23, 30 + f, 6, 2 + f * 3, HEX.ROSE_D);
    circle(c, 14, 16, 5.5, HEX.SPIRIT, OUT, 2); circle(c, 32, 16, 5.5, HEX.SPIRIT, OUT, 2);
    eye(c, 14, 16, 2.4, HEX.HFIRE); eye(c, 32, 16, 2.4, HEX.HFIRE);
  });
  // Sentinel — floating spiked eye (late-game elite fodder)
  for (const f of [0, 1]) make('sentinel' + f, 64, 64, (c) => {
    shadow(c, 32, 60, 14 * SHADOW.floatWidth, 4 * SHADOW.floatWidth, SHADOW.floatAlpha);
    c.save(); c.translate(32, 28); c.rotate(f ? 0.2 : 0);
    poly(c, star(0, 0, 27, 15, 8), HEX.SHROUD_D, OUT, 2.5);
    c.restore();
    circle(c, 32, 28, 16, radial(c, 24, 20, 16, [[0, HEX.WHITE], [0.4, HEX.RIM], [1, HEX.GLOOM_L]]), OUT, 2.5);
    circle(c, 32, 28, 8, HEX.HEYE); circle(c, 32, 28, 4, HEX.INK); circle(c, 29, 25, 2, HEX.WHITE);
  });
  // ---- Bosses ----
  // Brood Matron
  for (const f of [0, 1]) make('matron' + f, 150, 140, (c) => {
    shadow(c, 75, 128, 58, 12);
    c.strokeStyle = OUT; c.lineWidth = 6; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const a = 0.3 + i * 0.4 + (f && i % 2 ? 0.12 : 0);
      c.beginPath(); c.moveTo(75 + s * 25, 80);
      c.quadraticCurveTo(75 + s * (50 + i * 6), 40 + i * 14, 75 + s * (60 + Math.cos(a) * 12), 110 + i * 5);
      c.stroke();
    }
    c.strokeStyle = HEX.ROSE_D; c.lineWidth = 3;
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const a = 0.3 + i * 0.4 + (f && i % 2 ? 0.12 : 0);
      c.beginPath(); c.moveTo(75 + s * 25, 80);
      c.quadraticCurveTo(75 + s * (50 + i * 6), 40 + i * 14, 75 + s * (60 + Math.cos(a) * 12), 110 + i * 5);
      c.stroke();
    }
    ellipse(c, 75, 92, 40, 30, lin(c, 0, 62, 0, 122, [[0, HEX.GLOOM], [1, HEX.GLOOM_D]]), OUT, 4);
    for (let i = 0; i < 6; i++) circle(c, 55 + i * 8, 100 + (i % 2) * 8, 4, HEX.VOID, OUT, 1.5);
    circle(c, 75, 52, 26, lin(c, 0, 26, 0, 78, [[0, HEX.GLOOM_L], [1, HEX.GLOOM_D]]), OUT, 4);
    const eyes = [[63, 46, 4], [87, 46, 4], [75, 40, 3], [68, 58, 3], [82, 58, 3], [75, 52, 5]];
    for (const [x, y, r] of eyes) eye(c, x, y, r, HEX.HGLARE);
  });
  // Cinder Colossus
  for (const f of [0, 1]) make('colossus' + f, 190, 190, (c) => {
    shadow(c, 95, 176, 70, 14);
    const l = f ? 5 : 0;
    c.fillStyle = HEX.HULK_D; c.strokeStyle = OUT; c.lineWidth = 5;
    c.beginPath(); c.roundRect(58, 140 - l, 28, 38, 8); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(104, 140 + l - 5, 28, 38, 8); c.fill(); c.stroke();
    poly(c, [[40, 140], [30, 70], [60, 36], [130, 36], [160, 70], [150, 140]], HEX.HULK, OUT, 5);
    poly(c, [[52, 132], [46, 76], [68, 48], [122, 48], [144, 76], [138, 132]], HEX.HULK_L);
    glowDot(c, 95, 96, 34, rgba(HEX.HFIRE, 0.95));
    poly(c, star(95, 96, 18, 9, 6, f * 0.3), HEX.SAND);
    c.strokeStyle = HEX.HFIRE; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(60, 70); c.lineTo(76, 88); c.moveTo(130, 72); c.lineTo(114, 88); c.moveTo(80, 130); c.lineTo(95, 116); c.lineTo(110, 132); c.stroke();
    c.fillStyle = HEX.HULK; c.strokeStyle = OUT; c.lineWidth = 5;
    c.beginPath(); c.roundRect(8, 66 + l, 30, 70, 12); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(152, 66 - l, 30, 70, 12); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(70, 8, 50, 40, 12); c.fill(); c.stroke();
    c.fillStyle = HEX.INK; c.fillRect(78, 22, 34, 10);
    eye(c, 86, 27, 4, HEX.HFIRE); eye(c, 104, 27, 4, HEX.HFIRE);
  });
  // Gloam Herald — gaunt shadow in a tattered cloak, crown of three pale eye-lights, black banner
  for (const f of [0, 1]) make('herald' + f, 90, 120, (c) => {
    shadow(c, 45, 112, 26, 6);
    // banner pole + tattered black banner
    c.strokeStyle = HEX.SLATE_D; c.lineWidth = 3; c.beginPath(); c.moveTo(70, 112); c.lineTo(70, 10); c.stroke();
    c.beginPath(); c.moveTo(70, 14); c.lineTo(88 - f * 3, 18); c.lineTo(84 - f * 2, 34); c.lineTo(88, 40 + f * 2); c.lineTo(72, 44); c.closePath();
    c.fillStyle = HEX.INK; c.fill(); c.strokeStyle = HEX.SLATE; c.lineWidth = 1.5; c.stroke();
    circle(c, 79, 28, 3, null, HEX.GLOOM_L, 1.2);
    // cloak body: tall tapered shape with ragged hem
    c.beginPath(); c.moveTo(45, 22);
    c.bezierCurveTo(62, 30, 64, 70, 62, 104);
    c.lineTo(56, 98); c.lineTo(52, 108); c.lineTo(46, 99); c.lineTo(40, 110); c.lineTo(35, 99); c.lineTo(29, 106); c.lineTo(28, 96);
    c.bezierCurveTo(26, 70, 28, 30, 45, 22);
    c.fillStyle = lin(c, 0, 22, 0, 108, [[0, HEX.SHROUD], [1, HEX.SHROUD_D]]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    // arm holding pole
    c.strokeStyle = HEX.SHROUD; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(55, 44); c.lineTo(68, 50 + f); c.stroke();
    // hood with void face
    c.beginPath(); c.moveTo(45, 6); c.bezierCurveTo(60, 12, 58, 34, 45, 38); c.bezierCurveTo(32, 34, 30, 12, 45, 6);
    c.fillStyle = HEX.SHROUD; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
    ellipse(c, 45, 25, 8, 9, HEX.INK);
    // crown of three pale eye-lights
    for (const [x, y] of [[37, 9], [45, 4], [53, 9]]) glowDot(c, x, y, 6, rgba(HEX.RIM, 0.85));
    eye(c, 41, 25, 1.6, HEX.RIM); eye(c, 49, 25, 1.6, HEX.RIM);
  });
  // Eclipse Tyrant — a black sun wearing a crown of corona
  for (const f of [0, 1]) make('tyrant' + f, 220, 220, (c) => {
    shadow(c, 110, 200, 46 * SHADOW.floatWidth, 14 * SHADOW.floatWidth, SHADOW.floatAlpha);
    c.save(); c.translate(110, 105);
    c.fillStyle = radial(c, 0, 0, 108, [[0, rgba(HEX.BONE, 0)], [0.55, rgba(HEX.SAND, 0.0)], [0.62, rgba(HEX.SAND, 0.9)], [0.8, rgba(HEX.HFIRE, 0.35)], [1, rgba(HEX.HEYE_D, 0)]]);
    c.beginPath(); c.arc(0, 0, 108, 0, TAU); c.fill();
    c.rotate(f * 0.15);
    poly(c, star(0, 0, 100, 64, 14), rgba(HEX.HFIRE, 0.55));
    c.rotate(-f * 0.3);
    poly(c, star(0, 0, 86, 62, 10, 0.3), rgba(HEX.SAND, 0.6));
    c.rotate(f * 0.15);
    circle(c, 0, 0, 62, radial(c, -12, -12, 70, [[0, HEX.ROSE_D], [1, HEX.INK]]), HEX.INK, 4);
    // crown
    poly(c, [[-36, -50], [-30, -84], [-14, -62], [0, -96], [14, -62], [30, -84], [36, -50]], HEX.INK, HEX.INK, 3);
    for (const x of [-30, 0, 30]) circle(c, x, x ? -84 : -96, 4, HEX.HEYE);
    eye(c, -22, -6, 7, HEX.HEYE); eye(c, 22, -6, 7, HEX.HEYE);
    c.strokeStyle = HEX.HEYE; c.lineWidth = 3; c.beginPath(); c.arc(0, 18, 20, 0.2, Math.PI - 0.2); c.stroke();
    c.restore();
  });
  // Cinder Imp — squat ember-bodied imp with a flame tuft (Ashfields)
  for (const f of [0, 1]) make('imp' + f, 40, 42, (c) => {
    shadow(c, 20, 38, 11, 3.5);
    const hop = f ? -2 : 0;
    c.save(); c.translate(0, hop);
    // flame tuft
    c.fillStyle = radial(c, 20, 10, 12, [[0, HEX.BOG_L], [0.4, HEX.HFIRE], [1, rgba(HEX.HFIRE, 0)]]);
    c.beginPath(); c.moveTo(14, 16); c.quadraticCurveTo(13 + f * 2, 4, 20, 1); c.quadraticCurveTo(26 - f * 2, 6, 26, 16); c.fill();
    // horns
    poly(c, [[12, 15], [8, 6], [15, 12]], HEX.WOOD_D, OUT, 1.5);
    poly(c, [[28, 15], [32, 6], [25, 12]], HEX.WOOD_D, OUT, 1.5);
    // body
    c.beginPath(); c.ellipse(20, 25, 11, 11, 0, 0, TAU);
    c.fillStyle = radial(c, 17, 21, 14, [[0, HEX.HFIRE], [0.6, HEX.HFIRE_B], [1, HEX.HFIRE_D]]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    // ember cracks
    c.strokeStyle = HEX.SAND; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(14, 30); c.lineTo(17, 27); c.lineTo(15, 24); c.moveTo(26, 29); c.lineTo(23, 27); c.stroke();
    // stubby arms
    ellipse(c, 8, 27 + (f ? -2 : 1), 3, 4, HEX.HFIRE_B, OUT, 1.5);
    ellipse(c, 32, 27 + (f ? 1 : -2), 3, 4, HEX.HFIRE_B, OUT, 1.5);
    eye(c, 16, 23, 1.8, HEX.HGLARE); eye(c, 24, 23, 1.8, HEX.HGLARE);
    c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.arc(20, 28, 3.5, 0.3, Math.PI - 0.3); c.stroke();
    c.restore();
  });
  // Frost Wisp — drifting pale flame of ice with orbiting crystal shards (Rimewood)
  for (const f of [0, 1]) make('frostwisp' + f, 44, 48, (c) => {
    shadow(c, 22, 44, 9 * SHADOW.floatWidth, 3 * SHADOW.floatWidth, SHADOW.floatAlpha);
    glowDot(c, 22, 22, 20, rgba(HEX.FROST, 0.45));
    c.save(); c.translate(22, 24);
    c.beginPath(); c.moveTo(0, -20 + f * 2);
    c.bezierCurveTo(10, -10, 12, 4, 6, 11); c.quadraticCurveTo(0, 15, -6, 11);
    c.bezierCurveTo(-12, 4, -10, -10, 0, -20 + f * 2);
    c.fillStyle = lin(c, 0, -20, 0, 14, [[0, rgba(HEX.FROST_H, 0.95)], [0.5, rgba(HEX.FROST, 0.9)], [1, rgba(HEX.FROST_D, 0.85)]]); c.fill();
    c.lineWidth = 2; c.strokeStyle = HEX.INK; c.stroke();
    ellipse(c, 0, 2, 6, 7, rgba(HEX.SLATE_D, 0.85));
    eye(c, -2.5, 1, 1.5, HEX.FROST_H); eye(c, 2.5, 1, 1.5, HEX.FROST_H);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + f * 0.5;
      const x = Math.cos(a) * 15, y = Math.sin(a) * 9 + 4;
      poly(c, [[x, y - 4], [x + 2.5, y], [x, y + 4], [x - 2.5, y]], HEX.FROST_H, HEX.FROST_D, 1);
    }
    c.restore();
  });
  // Mire Lurker — bog creature: mossy hump with lantern-eyes (Drowned Marsh). Frame 0 surfaced, frame 1 mid-sink
  for (const f of [0, 1]) make('lurker' + f, 48, 40, (c) => {
    c.fillStyle = rgba(HEX.MOSS_D, 0.5); c.beginPath(); c.ellipse(24, 33, 20, 5, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(HEX.SPIRIT_L, 0.45); c.lineWidth = 1.5; c.beginPath(); c.ellipse(24, 33, 21, 6, 0, 0, TAU); c.stroke();
    const top = f ? 20 : 8;
    c.beginPath(); c.moveTo(6, 33); c.bezierCurveTo(6, top, 42, top, 42, 33); c.closePath();
    c.fillStyle = lin(c, 0, top, 0, 33, [[0, HEX.BOG], [1, HEX.BOG_D]]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    for (const [x, y] of [[15, top + 8], [30, top + 6], [23, top + 3]]) circle(c, x, y, 2.4, HEX.BOG_L);
    c.strokeStyle = HEX.MOSS; c.lineWidth = 2; c.beginPath(); c.moveTo(12, top + 10); c.quadraticCurveTo(10, top + 16, 13, 30); c.stroke();
    if (!f) { eye(c, 18, top + 12, 2.2, HEX.HGLARE); eye(c, 30, top + 12, 2.2, HEX.HGLARE); }
    else { eye(c, 19, top + 9, 1.6, HEX.HGLARE); eye(c, 29, top + 9, 1.6, HEX.HGLARE); }
  });
  // Gloom Totem — breakable crystal obelisk that holds loot
  make('totem', 40, 60, (c) => {
    shadow(c, 20, 54, 15, 4);
    glowDot(c, 20, 28, 20, rgba(HEX.SAND, 0.45));
    poly(c, [[20, 2], [32, 20], [27, 52], [13, 52], [8, 20]], HEX.SHROUD_D, OUT, 2.5);
    poly(c, [[20, 8], [27, 21], [20, 44], [13, 21]], HEX.SAND);
    poly(c, [[20, 8], [27, 21], [20, 26]], HEX.BONE);
  });
  // The Hollow — a drifting shroud around a pale, weeping mask; nothing behind the eyes
  for (const f of [0, 1]) make('hollow' + f, 110, 120, (c) => {
    shadow(c, 55, 112, 30 * SHADOW.floatWidth, 6 * SHADOW.floatWidth, SHADOW.floatAlpha);
    glowDot(c, 55, 56, 52, rgba(HEX.GLOOM, 0.35));
    c.beginPath(); c.moveTo(55, 10);
    c.bezierCurveTo(88, 14, 96, 60, 90, 98);
    for (let i = 0; i < 6; i++) { const x = 90 - i * 14.5; c.lineTo(x - 7, 100 + ((i + f) % 2) * 12); c.lineTo(x - 14.5, 96 + ((i + f) % 2) * -4); }
    c.bezierCurveTo(14, 60, 22, 14, 55, 10);
    c.fillStyle = lin(c, 0, 10, 0, 110, [[0, HEX.ROSE_D], [1, HEX.INK]]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = HEX.GLOOM; c.stroke();
    // bone-white mask
    c.beginPath(); c.moveTo(55, 18); c.bezierCurveTo(78, 20, 80, 44, 72, 64); c.quadraticCurveTo(55, 80, 38, 64); c.bezierCurveTo(30, 44, 32, 20, 55, 18);
    c.fillStyle = HEX.FROST_H; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    ellipse(c, 45, 42, 5, 9, HEX.INK); ellipse(c, 65, 42, 5, 9, HEX.INK);
    c.strokeStyle = HEX.GLOOM; c.lineWidth = 2; c.beginPath(); c.moveTo(45, 50); c.lineTo(44, 66 + f * 3); c.moveTo(65, 50); c.lineTo(66, 66 + f * 3); c.stroke();
    ellipse(c, 55, 66, 4, 6 + f, HEX.INK);
    eye(c, 45, 42, 2, HEX.GLOOM_L); eye(c, 65, 42, 2, HEX.GLOOM_L);
  });
  // Glass Scarab — fast glassy desert beetle: iridescent turquoise/gold shell, wings and legs flicker
  for (const f of [0, 1]) make('scarab' + f, 40, 40, (c) => {
    shadow(c, 20, 35, 11, 3);
    c.save(); c.translate(20, 21);
    // legs
    c.strokeStyle = OUT; c.lineWidth = 2.2; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const k = (i + f) % 2 ? 3 : -2;
      c.beginPath(); c.moveTo(s * 7, -2 + i * 6); c.lineTo(s * 14, -4 + i * 7 + k); c.lineTo(s * 16, 1 + i * 7 + k); c.stroke();
    }
    c.strokeStyle = HEX.SAND; c.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const k = (i + f) % 2 ? 3 : -2;
      c.beginPath(); c.moveTo(s * 7, -2 + i * 6); c.lineTo(s * 14, -4 + i * 7 + k); c.lineTo(s * 16, 1 + i * 7 + k); c.stroke();
    }
    // flickering gauzy wings
    c.fillStyle = rgba(HEX.SPIRIT_L, 0.55); c.strokeStyle = rgba(HEX.SPIRIT_D, 0.8); c.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1);
      c.beginPath(); c.ellipse(f ? 11 : 9, f ? -2 : 3, f ? 8.5 : 6, f ? 5.5 : 8, f ? -0.5 : 0.3, 0, TAU); c.fill(); c.stroke();
      c.restore();
    }
    // shell
    c.beginPath(); c.ellipse(0, 3, 10.5, 13, 0, 0, TAU);
    c.fillStyle = lin(c, -10, -8, 10, 16, [[0, HEX.SPIRIT_L], [0.45, HEX.FROST], [0.75, HEX.HGLARE], [1, HEX.GLOOM]]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = rgba(HEX.MOSS_D, 0.8); c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 15); c.stroke();
    ellipse(c, -4.5, -1, 2.8, 6, rgba(HEX.WHITE, 0.45));
    c.strokeStyle = HEX.BOG_L; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 3, 8.5, 0.4, 2.7); c.stroke();
    // head + horn
    ellipse(c, 0, -11, 6, 4.5, HEX.FROST_D, OUT, 2);
    poly(c, [[-2, -14], [0, -21], [2, -14]], HEX.BOG_L, OUT, 1.4);
    eye(c, -3, -11, 1.4, HEX.HGLARE); eye(c, 3, -11, 1.4, HEX.HGLARE);
    c.restore();
  });
  // Candle Acolyte — hooded cultist wraith of a ruined cathedral, pale tattered robes, guttering candle
  for (const f of [0, 1]) make('acolyte' + f, 46, 50, (c) => {
    shadow(c, 23, 46, 13, 3.5);
    const w = f ? 2.5 : -2.5;
    c.save(); c.translate(23, 0);
    // robe
    c.beginPath(); c.moveTo(-12, 22); c.quadraticCurveTo(-14, 6, 0, 4); c.quadraticCurveTo(14, 6, 12, 22);
    c.lineTo(14, 40); c.lineTo(9, 37 + w * 0.5); c.lineTo(6, 46); c.lineTo(1, 38 + w); c.lineTo(-3, 47); c.lineTo(-7, 38 - w); c.lineTo(-11, 44); c.lineTo(-14, 38);
    c.closePath();
    c.fillStyle = lin(c, 0, 4, 0, 47, [[0, HEX.BONE], [0.6, HEX.HULK_L], [1, rgba(HEX.HULK, 0.55)]]); c.fill();
    c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = rgba(HEX.SLATE, 0.55); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-4, 24); c.lineTo(-5, 36); c.moveTo(4, 24); c.lineTo(5 + w * 0.3, 35); c.stroke();
    // rope belt
    c.strokeStyle = HEX.WOOD; c.lineWidth = 2; c.beginPath(); c.moveTo(-11, 27); c.quadraticCurveTo(0, 30, 11, 27); c.stroke();
    // hood and hollow face
    c.beginPath(); c.moveTo(-10, 18); c.bezierCurveTo(-12, 0, 12, 0, 10, 18); c.quadraticCurveTo(0, 22, -10, 18);
    c.fillStyle = HEX.BONE; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
    ellipse(c, 0, 13, 6.6, 6.8, HEX.INK);
    eye(c, -3, 12.5, 1.7, HEX.SAND); eye(c, 3, 12.5, 1.7, HEX.SAND);
    // arm + candle, flame flickers between frames
    c.strokeStyle = HEX.BONE; c.lineWidth = 4.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(8, 22); c.lineTo(15, 25); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = HEX.BONE; c.strokeStyle = OUT; c.lineWidth = 1.6;
    c.beginPath(); c.roundRect(14, 20, 5, 9, 1.5); c.fill(); c.stroke();
    glowDot(c, 16.5, 13 - f, 11 + f * 2, rgba(HEX.SAND, 0.75));
    c.beginPath(); c.moveTo(16.5, 20); c.quadraticCurveTo(12 + f * 2, 14, 16.5 + w * 0.3, 8 - f * 2); c.quadraticCurveTo(21, 14, 16.5, 20);
    c.fillStyle = HEX.HFIRE; c.fill();
    c.beginPath(); c.moveTo(16.5, 19); c.quadraticCurveTo(14.5, 15, 16.5, 11.5 - f); c.quadraticCurveTo(18.5, 15, 16.5, 19);
    c.fillStyle = HEX.BONE; c.fill();
    c.restore();
  });
  drawExtraEnemies();
  for (const n of Object.keys(frames)) if (/^(gloomling|moth|husk|wraith|splitter|broodling|beetle|spitter|sentinel|matron|colossus|herald|tyrant|imp|frostwisp|lurker|hollow|scarab|acolyte|stormkite|forge|totem)\d?$/.test(n)) rimFrame(n);
  // White flash variants
  for (const n of ['gloomling0', 'gloomling1', 'moth0', 'moth1', 'husk0', 'husk1', 'wraith0', 'wraith1',
    'splitter0', 'splitter1', 'broodling0', 'broodling1', 'beetle0', 'beetle1', 'spitter0', 'spitter1',
    'sentinel0', 'sentinel1', 'matron0', 'matron1', 'colossus0', 'colossus1', 'tyrant0', 'tyrant1', 'totem', 'herald0', 'herald1',
    'imp0', 'imp1', 'frostwisp0', 'frostwisp1', 'lurker0', 'lurker1', 'scarab0', 'scarab1', 'acolyte0', 'acolyte1',
    'forge0', 'forge1', 'sunbearer0', 'sunbearer1', 'stormkite0', 'stormkite1']) makeWhite(n);
}

// ---------- decor ----------
// Background props sit back: desaturate + darken the finished sprite so pickups and enemies pop.
function dimFrame(name) {
  normFrame(name);
}
// One prop rule: solid pixels (skipping the ink outline) land on the same luminance, lightly desaturated.
// A single multiply misses that target once highlights clip or darkened pixels fall inside the ink
// exclusion, so the gain is adjusted until the measured core mean actually sits on the target.
function normFrame(name) {
  const src = frames[name];
  const img = actx.getImageData(src.x * SS, src.y * SS, src.w * SS, src.h * SS);
  const d = img.data;
  const base = new Uint8ClampedArray(d);
  const li = (ch) => { ch /= 255; return ch <= 0.04045 ? ch / 12.92 : ((ch + 0.055) / 1.055) ** 2.4; };
  const en = (v) => Math.round(255 * Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
  const ir = parseInt(HEX.INK.slice(1, 3), 16), ig = parseInt(HEX.INK.slice(3, 5), 16), ib = parseInt(HEX.INK.slice(5, 7), 16);
  const yOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const coreY = () => {
    let n = 0, s = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 150) continue;
      if (Math.abs(d[i] - ir) + Math.abs(d[i + 1] - ig) + Math.abs(d[i + 2] - ib) < 40) continue;
      n++;
      s += yOf(li(d[i]), li(d[i + 1]), li(d[i + 2]));
    }
    return n ? s / n : 0;
  };
  const apply = (k, lift) => {
    const ds = PROP_RULE.desaturate;
    for (let i = 0; i < d.length; i += 4) {
      d[i + 3] = base[i + 3];
      if (!base[i + 3]) { d[i] = d[i + 1] = d[i + 2] = 0; continue; }
      const r = li(base[i]), g = li(base[i + 1]), b = li(base[i + 2]);
      const y = yOf(r, g, b);
      d[i] = en(Math.min(1, (r + (y - r) * ds) * k + lift));
      d[i + 1] = en(Math.min(1, (g + (y - g) * ds) * k + lift));
      d[i + 2] = en(Math.min(1, (b + (y - b) * ds) * k + lift));
    }
  };
  const target = PROP_RULE.targetLuminance;
  const y0 = coreY();
  if (!y0) return;
  let k = target / y0;
  apply(k, 0);
  let y = coreY();
  for (let i = 0; i < 8 && y && Math.abs(y - target) >= 0.001; i++) {
    const next = Math.min(8, Math.max(0.02, k * target / y));
    if (Math.abs(next - k) < 1e-4) break;
    k = next;
    apply(k, 0);
    y = coreY();
  }
  if (y && y < target - 0.001) {
    let lift = 0;
    for (let i = 0; i < 8 && Math.abs(y - target) >= 0.001; i++) {
      lift = Math.max(0, lift + (target - y) * 0.85);
      apply(k, lift);
      y = coreY();
    }
  }
  actx.putImageData(img, src.x * SS, src.y * SS);
}
function rimFrame(name) {
  const f = frames[name];
  if (!f) return;
  const W = f.w * SS, H = f.h * SS;
  const img = actx.getImageData(f.x * SS, f.y * SS, W, H);
  const d = img.data, a0 = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) a0[i] = d[i * 4 + 3];
  const rc = [(RIM.color >> 16) & 255, (RIM.color >> 8) & 255, RIM.color & 255];
  const ra = Math.round(RIM.alpha * 255), rad = RIM.width * SS;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (a0[i] >= 60) continue;
      let hit = false;
      for (let dy = -rad; dy <= rad && !hit; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          if (a0[yy * W + xx] >= 200) { hit = true; break; }
        }
      }
      if (!hit) continue;
      const a = a0[i] / 255, na = ra / 255, oa = na + a * (1 - na);
      for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = Math.round((rc[ch] * na + d[i * 4 + ch] * a * (1 - na)) / oa);
      d[i * 4 + 3] = Math.round(oa * 255);
    }
  }
  actx.putImageData(img, f.x * SS, f.y * SS);
}
function drawDecor() {
  const dm = (name, w, h, draw) => { make(name, w, h, draw); dimFrame(name); };
  // ---- Ashfields props ----
  dm('stump', 40, 44, (c) => {
    shadow(c, 20, 39, 16, 4);
    poly(c, [[8, 38], [10, 18], [14, 14], [26, 14], [30, 18], [32, 38]], HEX.WOOD_D, OUT, 2.5);
    c.strokeStyle = HEX.INK; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(15, 18); c.lineTo(14, 36); c.moveTo(22, 17); c.lineTo(23, 37); c.stroke();
    ellipse(c, 20, 15, 10, 3.5, HEX.WOOD, OUT, 2);
    c.strokeStyle = HEX.HFIRE; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(11, 28); c.lineTo(14, 25); c.moveTo(27, 32); c.lineTo(29, 27); c.stroke();
    poly(c, [[28, 20], [36, 8], [31, 19]], HEX.WOOD_D, OUT, 1.5);
  });
  dm('vent', 40, 26, (c) => {
    glowDot(c, 20, 13, 16, rgba(HEX.HFIRE, 0.6));
    ellipse(c, 20, 14, 15, 7, HEX.WOOD_D, OUT, 2);
    ellipse(c, 20, 14, 9, 4, radial(c, 20, 14, 9, [[0, HEX.HFIRE_H], [0.4, HEX.HFIRE], [1, HEX.HFIRE_D]]));
    for (const [x, y] of [[9, 9], [31, 10], [14, 20]]) circle(c, x, y, 1.6, HEX.HFIRE_H);
  });
  dm('basalt', 34, 30, (c) => {
    shadow(c, 17, 26, 15, 4);
    poly(c, [[4, 26], [6, 12], [12, 6], [22, 8], [30, 14], [30, 26]], HEX.WOOD_D, OUT, 2);
    poly(c, [[12, 6], [22, 8], [18, 14], [10, 12]], HEX.HULK_D);
    c.strokeStyle = HEX.HFIRE; c.lineWidth = 1.2; c.beginPath(); c.moveTo(9, 20); c.lineTo(15, 17); c.lineTo(20, 22); c.stroke();
  });
  // ---- Rimewood props ----
  dm('pine', 44, 70, (c) => {
    shadow(c, 22, 64, 16, 5);
    c.fillStyle = HEX.WOOD_D; c.fillRect(19, 52, 6, 12);
    for (let i = 0; i < 3; i++) {
      const y = 14 + i * 14, w = 10 + i * 6;
      poly(c, [[22, y - 12], [22 + w, y + 10], [22 - w, y + 10]], HEX.MOSS_D, OUT, 2);
      poly(c, [[22, y - 12], [22 + w * 0.55, y + 2], [22 - w * 0.6, y + 3]], HEX.FROST_H);
    }
  });
  dm('icecluster', 36, 34, (c) => {
    shadow(c, 18, 30, 14, 3.5);
    glowDot(c, 18, 18, 16, rgba(HEX.FROST, 0.35));
    for (const [x, h, w] of [[11, 18, 4], [19, 26, 5], [26, 14, 4]]) {
      poly(c, [[x, 30 - h], [x + w, 30 - h * 0.35], [x + w * 0.4, 30], [x - w * 0.6, 30], [x - w, 30 - h * 0.35]], HEX.FROST_L, HEX.FROST_D, 1.5);
      poly(c, [[x, 30 - h], [x + w, 30 - h * 0.35], [x, 30 - h * 0.3]], HEX.FROST_H);
    }
  });
  dm('snowrock', 36, 28, (c) => {
    shadow(c, 18, 24, 16, 4);
    poly(c, [[4, 22], [8, 10], [18, 4], [30, 9], [33, 22]], HEX.SLATE, OUT, 2);
    c.beginPath(); c.moveTo(7, 12); c.quadraticCurveTo(18, 1, 31, 10); c.quadraticCurveTo(20, 9, 7, 12);
    c.fillStyle = HEX.FROST_H; c.fill();
  });
  // ---- Drowned Marsh props ----
  dm('reeds', 30, 40, (c) => {
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 3.6, h = 18 + ((i * 7) % 13);
      c.strokeStyle = i % 2 ? HEX.MOSS : HEX.MOSS; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, 38); c.quadraticCurveTo(x + (i % 3 - 1) * 4, 38 - h * 0.6, x + (i % 3 - 1) * 5, 38 - h); c.stroke();
      if (i % 2 === 0) ellipse(c, x + (i % 3 - 1) * 5, 38 - h + 3, 1.8, 4.5, HEX.WOOD, OUT, 1);
    }
  });
  dm('lilypad', 34, 20, (c) => {
    c.beginPath(); c.ellipse(17, 10, 15, 8, 0, 0.35, TAU - 0.15); c.lineTo(17, 10); c.closePath();
    c.fillStyle = HEX.MOSS; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = HEX.MOSS_L; c.lineWidth = 1; c.beginPath(); c.moveTo(17, 10); c.lineTo(6, 8); c.moveTo(17, 10); c.lineTo(22, 16); c.stroke();
    glowDot(c, 24, 8, 6, rgba(HEX.SLATE_H, 0.5));
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; circle(c, 24 + Math.cos(a) * 2.6, 8 + Math.sin(a) * 2.6, 2, HEX.SLATE_H); }
    circle(c, 24, 8, 1.4, HEX.BOG_L);
  });
  dm('sunklantern', 30, 40, (c) => {
    c.fillStyle = rgba(HEX.MOSS_D, 0.45); c.beginPath(); c.ellipse(15, 34, 13, 4, 0, 0, TAU); c.fill();
    glowDot(c, 15, 18, 14, rgba(HEX.BOG_L, 0.5));
    c.save(); c.translate(15, 22); c.rotate(-0.25);
    c.fillStyle = HEX.MOSS_D; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.roundRect(-6, -10, 12, 16, 2); c.fill(); c.stroke();
    c.fillStyle = rgba(HEX.BOG_L, 0.85); c.fillRect(-4, -7, 8, 9);
    c.beginPath(); c.moveTo(-5, -10); c.lineTo(0, -15); c.lineTo(5, -10); c.stroke();
    c.restore();
  });
  dm('rock0', 36, 28, (c) => {
    shadow(c, 18, 24, 16, 4);
    poly(c, [[4, 22], [8, 10], [18, 4], [30, 9], [33, 22]], HEX.SLATE, OUT, 2);
    poly(c, [[9, 12], [18, 6], [27, 10], [20, 14]], HEX.SLATE);
  });
  dm('rock1', 24, 20, (c) => {
    shadow(c, 12, 17, 10, 3);
    poly(c, [[3, 16], [6, 7], [14, 3], [21, 8], [21, 16]], HEX.SLATE_D, OUT, 2);
  });
  dm('grass', 28, 22, (c) => {
    c.strokeStyle = HEX.MOSS; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = 5 + i * 3;
      c.beginPath(); c.moveTo(x, 20); c.quadraticCurveTo(x + (rnd() - 0.5) * 8, 10, x + (rnd() - 0.5) * 10, 3 + rnd() * 6); c.stroke();
    }
  });
  dm('shroom', 24, 24, (c) => {
    glowDot(c, 12, 10, 12, rgba(HEX.SPIRIT_L, 0.5));
    c.fillStyle = HEX.FROST_H; c.fillRect(10, 11, 4, 10);
    c.beginPath(); c.arc(12, 11, 8, Math.PI, 0); c.fillStyle = HEX.SPIRIT; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    circle(c, 9, 8, 1.4, HEX.FROST_H); circle(c, 15, 7, 1.1, HEX.FROST_H);
  });
  dm('bones', 32, 20, (c) => {
    c.strokeStyle = HEX.BONE; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(4, 15); c.lineTo(22, 6); c.moveTo(10, 4); c.lineTo(26, 16); c.stroke();
    circle(c, 25, 11, 5, HEX.BONE, OUT, 1.5);
    circle(c, 23.5, 10, 1.2, OUT); circle(c, 26.5, 10, 1.2, OUT);
  });
  dm('pillar', 40, 72, (c) => {
    shadow(c, 20, 66, 18, 5);
    c.fillStyle = HEX.SLATE; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(9, 18, 22, 48, 2); c.fill(); c.stroke();
    c.fillStyle = HEX.SLATE; c.fillRect(13, 20, 4, 44);
    poly(c, [[7, 18], [10, 8], [18, 12], [24, 4], [33, 18]], HEX.SLATE, OUT, 2.5);
    c.fillStyle = HEX.MOSS; c.beginPath(); c.ellipse(16, 60, 9, 4, 0, 0, TAU); c.fill();
  });
  dm('flower', 20, 20, (c) => {
    glowDot(c, 10, 9, 9, rgba(HEX.ROSE_L, 0.45));
    c.strokeStyle = HEX.MOSS; c.lineWidth = 1.5; c.beginPath(); c.moveTo(10, 19); c.lineTo(10, 10); c.stroke();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; circle(c, 10 + Math.cos(a) * 3.5, 8 + Math.sin(a) * 3.5, 2.6, HEX.ROSE_L); }
    circle(c, 10, 8, 2, HEX.BOG_L);
  });

  drawStageDecor();
  drawNewScenery();
}
// Props for the Gothic reliquary and Glass desert stages: muted, low contrast, clearly background.
function drawStageDecor() {
  const mk = (name, w, h, draw) => { make(name, w, h, draw); dimFrame(name, 0.12, 0.88); };
  // ---- Ruined Reliquary ----
  mk('tomb', 56, 44, (c) => {
    shadow(c, 28, 39, 25, 5);
    poly(c, [[5, 38], [6, 20], [50, 20], [51, 38]], HEX.SLATE, OUT, 2.5);
    poly(c, [[8, 36], [9, 23], [47, 23], [48, 36]], HEX.SLATE);
    c.strokeStyle = HEX.SLATE_D; c.lineWidth = 1.2; c.beginPath(); c.moveTo(14, 36); c.lineTo(14, 26); c.moveTo(28, 36); c.lineTo(28, 26); c.moveTo(42, 36); c.lineTo(42, 26); c.stroke();
    // lid
    poly(c, [[3, 21], [9, 8], [47, 8], [53, 21]], HEX.SLATE_L, OUT, 2.5);
    poly(c, [[10, 10], [46, 10], [49, 19], [7, 19]], HEX.SLATE_L);
    c.strokeStyle = HEX.SLATE; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(28, 11); c.lineTo(28, 18); c.moveTo(24, 14.5); c.lineTo(32, 14.5); c.stroke();
    c.beginPath(); c.moveTo(38, 9); c.lineTo(34, 14); c.lineTo(37, 18); c.moveTo(16, 12); c.lineTo(19, 16); c.stroke();
    ellipse(c, 20, 40, 7, 2, rgba(HEX.MOSS, 0.5));
    poly(c, [[44, 8], [47, 3], [50, 9]], HEX.SLATE, OUT, 1.4);
  });
  mk('candelabra', 28, 64, (c) => {
    shadow(c, 14, 60, 11, 3);
    glowDot(c, 14, 14, 14, rgba(HEX.EMBER, 0.45));
    c.strokeStyle = OUT; c.lineWidth = 5; c.lineCap = 'round';
    const arms = () => { c.beginPath(); c.moveTo(14, 58); c.lineTo(14, 22); c.moveTo(14, 26); c.quadraticCurveTo(4, 26, 4, 15); c.moveTo(14, 26); c.quadraticCurveTo(24, 26, 24, 15); c.moveTo(14, 22); c.lineTo(14, 13); c.stroke(); };
    arms(); c.strokeStyle = HEX.SLATE; c.lineWidth = 2.6; arms();
    poly(c, [[7, 60], [10, 52], [18, 52], [21, 60]], HEX.SLATE, OUT, 2);
    for (const [x, y] of [[4, 15], [14, 13], [24, 15]]) {
      c.fillStyle = HEX.BONE; c.strokeStyle = OUT; c.lineWidth = 1.4; c.beginPath(); c.roundRect(x - 2.2, y - 2, 4.4, 8, 1); c.fill(); c.stroke();
      glowDot(c, x, y - 5, 5, rgba(HEX.EMBER_L, 0.9));
      c.beginPath(); c.moveTo(x, y - 2); c.quadraticCurveTo(x - 3, y - 6, x + 0.4, y - 10); c.quadraticCurveTo(x + 3, y - 6, x, y - 2);
      c.fillStyle = HEX.EMBER_L; c.fill();
    }
  });
  mk('banner', 36, 70, (c) => {
    shadow(c, 18, 66, 12, 3);
    c.strokeStyle = OUT; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(10, 66); c.lineTo(10, 6); c.stroke();
    c.strokeStyle = HEX.WOOD; c.lineWidth = 2.6; c.beginPath(); c.moveTo(10, 66); c.lineTo(10, 6); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 4.4; c.beginPath(); c.moveTo(6, 10); c.lineTo(32, 8); c.stroke();
    c.strokeStyle = HEX.WOOD; c.lineWidth = 2.2; c.beginPath(); c.moveTo(6, 10); c.lineTo(32, 8); c.stroke();
    c.beginPath(); c.moveTo(12, 11); c.lineTo(30, 10); c.lineTo(29, 30); c.lineTo(27, 44); c.lineTo(23, 38); c.lineTo(20, 52); c.lineTo(17, 40); c.lineTo(13, 46); c.closePath();
    c.fillStyle = lin(c, 0, 10, 0, 52, [[0, HEX.HEYE_D], [1, HEX.WOOD_D]]); c.fill();
    c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = HEX.SAND; c.lineWidth = 1.4; c.beginPath(); c.moveTo(21, 14); c.lineTo(21, 30); c.moveTo(16, 19); c.lineTo(26, 19); c.stroke();
    c.strokeStyle = HEX.WOOD_L; c.beginPath(); c.moveTo(14, 13); c.lineTo(29, 12); c.stroke();
  });
  mk('cobble', 48, 24, (c) => {
    c.fillStyle = rgba(HEX.G_RELIQ, 0.35); c.beginPath(); c.ellipse(24, 13, 22, 9, 0, 0, TAU); c.fill();
    for (const [x, y, w, h, a] of [[12, 9, 11, 7, -0.1], [27, 8, 10, 6, 0.1], [20, 15, 12, 7, 0.05], [35, 15, 9, 6, -0.12], [8, 17, 8, 5, 0.1]]) {
      c.save(); c.translate(x, y); c.rotate(a);
      c.fillStyle = HEX.SLATE; c.strokeStyle = rgba(HEX.INK, 0.7); c.lineWidth = 1.4;
      c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 2.5); c.fill(); c.stroke();
      c.fillStyle = rgba(HEX.WHITE, 0.07); c.fillRect(-w / 2 + 1.5, -h / 2 + 1, w - 3, 1.5);
      c.restore();
    }
    c.strokeStyle = HEX.BONE; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(30, 18); c.lineTo(38, 20); c.stroke();
    circle(c, 15, 20, 1, HEX.BONE); circle(c, 40, 8, 0.9, HEX.BONE);
  });
  // ---- Glass Desert ----
  mk('glasscluster', 44, 52, (c) => {
    shadow(c, 22, 47, 18, 4);
    glowDot(c, 22, 28, 22, rgba(HEX.OBJ, 0.3));
    const shard = (x, h, w, lean, a, b) => {
      const top = [x + lean, 46 - h];
      poly(c, [top, [x + w, 46 - h * 0.6], [x + w * 0.5, 46], [x - w * 0.6, 46], [x - w, 46 - h * 0.55]], lin(c, x - w, 46 - h, x + w, 46, [[0, a], [1, b]]), rgba(HEX.G_ROAD, 0.9), 1.6);
      poly(c, [top, [x + w, 46 - h * 0.6], [x + w * 0.1, 46 - h * 0.5]], rgba(HEX.WHITE, 0.35));
      c.strokeStyle = rgba(HEX.WHITE, 0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(x - w * 0.3, 44); c.lineTo(top[0], top[1] + 4); c.stroke();
    };
    shard(11, 26, 6, -2, rgba(HEX.OBJ, 0.9), rgba(HEX.FROST_D, 0.9));
    shard(32, 22, 6, 2, rgba(HEX.EMBER_L, 0.9), rgba(HEX.R_BRONZE, 0.9));
    shard(22, 46, 8, 1, rgba(HEX.SPIRIT_L, 0.92), rgba(HEX.FROST, 0.92));
    shard(27, 18, 4, 3, rgba(HEX.EMBER_L, 0.9), rgba(HEX.R_BRONZE, 0.9));
  });
  mk('bonespire', 36, 68, (c) => {
    shadow(c, 18, 63, 14, 4);
    ellipse(c, 18, 62, 13, 4, HEX.WOOD, OUT, 1.8);
    c.beginPath(); c.moveTo(8, 62); c.bezierCurveTo(6, 40, 14, 24, 28, 3); c.bezierCurveTo(26, 22, 28, 40, 27, 62); c.closePath();
    c.fillStyle = lin(c, 6, 0, 28, 0, [[0, HEX.BONE], [1, HEX.HULK]]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = rgba(HEX.WOOD, 0.5); c.lineWidth = 1.3;
    for (const y of [24, 36, 48]) { c.beginPath(); c.moveTo(11 + (60 - y) * 0.05, y); c.quadraticCurveTo(18, y + 3, 26, y - 1); c.stroke(); }
    // smaller rib arc
    c.beginPath(); c.moveTo(25, 62); c.bezierCurveTo(34, 46, 33, 38, 31, 28); c.lineWidth = 3.4; c.strokeStyle = OUT; c.stroke();
    c.lineWidth = 1.6; c.strokeStyle = HEX.BONE; c.stroke();
  });
  mk('drift', 64, 22, (c) => {
    c.fillStyle = radial(c, 32, 12, 30, [[0, rgba(HEX.SAND, 0.28)], [1, rgba(HEX.SAND, 0)]]);
    c.beginPath(); c.ellipse(32, 12, 31, 9, 0, 0, TAU); c.fill();
    c.lineCap = 'round';
    for (const [y, x0, x1, a] of [[8, 10, 52, 0.35], [12, 6, 56, 0.4], [16, 14, 50, 0.3]]) {
      c.strokeStyle = 'rgba(255,225,170,' + a + ')'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y - 4, x1, y + 0.5); c.stroke();
      c.strokeStyle = 'rgba(80,50,30,' + a * 0.6 + ')'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x0 + 2, y + 2); c.quadraticCurveTo((x0 + x1) / 2, y - 2, x1 - 2, y + 2.5); c.stroke();
    }
  });
}

// ---------- objectives, coast/march scenery, extra enemies, new Bearers ----------
// Objective entities must pop against the dark ground: bright rims, hot glows, no dimming.
function drawObjectives() {
  const rimLine = (c, col, lw = 1.4) => { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.stroke(); };
  // Waystone — carved standing stone, ember glyph (frame 1 lit)
  for (const f of [0, 1]) make('waystone' + f, 40, 64, (c) => {
    shadow(c, 20, 60, 16, 4);
    glowDot(c, 20, 30, f ? 26 : 19, f ? rgba(HEX.EMBER, 0.75) : rgba(HEX.EMBER, 0.35));
    poly(c, [[7, 59], [9, 16], [15, 5], [26, 4], [32, 15], [34, 59]], lin(c, 7, 0, 34, 0, [[0, HEX.SLATE_L], [0.5, HEX.SLATE_L], [1, HEX.SLATE]]), OUT, 2.5);
    poly(c, [[9, 16], [15, 5], [26, 4], [22, 14]], HEX.SLATE_H);
    c.beginPath(); c.moveTo(10, 56); c.lineTo(11, 17); c.lineTo(15, 8); rimLine(c, rgba(HEX.FROST_H, 0.75));
    c.fillStyle = HEX.SLATE_D; c.beginPath(); c.roundRect(4, 54, 32, 8, 3); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
    c.fillStyle = rgba(HEX.WHITE, 0.12); c.fillRect(7, 55.5, 26, 1.5);
    // glyph: flame in a ring with tick runes
    const g = f ? HEX.EMBER_L : HEX.EMBER;
    c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.arc(20, 30, 8.5, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(20, 21); c.quadraticCurveTo(26, 29, 20, 37); c.quadraticCurveTo(14, 29, 20, 21);
    c.fillStyle = g; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
    glowDot(c, 20, 31, f ? 8 : 5, f ? HEX.EMBER_H : rgba(HEX.EMBER_H, 0.8));
    c.strokeStyle = g; c.lineWidth = 1.6; c.beginPath(); c.moveTo(20, 15); c.lineTo(20, 18); c.moveTo(20, 45); c.lineTo(20, 49); c.moveTo(13, 49); c.lineTo(27, 49); c.stroke();
    if (f) for (const [x, y] of [[8, 12], [33, 20], [12, 4], [30, 8]]) circle(c, x, y, 1.3, HEX.EMBER_H);
  });
  // Cinder forge / nest — squat, spewing sparks (enemy texture)
  for (const f of [0, 1]) make('forge' + f, 72, 64, (c) => {
    shadow(c, 36, 58, 31, 6);
    glowDot(c, 36, 34, f ? 36 : 31, rgba(HEX.HFIRE, 0.6));
    c.beginPath(); c.moveTo(6, 56); c.bezierCurveTo(2, 36, 12, 18, 36, 16); c.bezierCurveTo(60, 18, 70, 36, 66, 56); c.closePath();
    c.fillStyle = lin(c, 0, 16, 0, 56, [[0, HEX.HULK], [1, HEX.HULK_D]]); c.fill(); c.lineWidth = 2.8; c.strokeStyle = OUT; c.stroke();
    // slag lumps + chimney
    for (const [x, y, r] of [[14, 40, 5], [58, 38, 5.5], [22, 24, 4], [52, 24, 4.5]]) circle(c, x, y, r, HEX.HULK, OUT, 1.8);
    c.fillStyle = HEX.HULK_D; c.beginPath(); c.roundRect(28, 6, 16, 14, 3); c.fill(); c.stroke();
    ellipse(c, 36, 7, 8, 2.6, f ? HEX.HFIRE : HEX.HFIRE, OUT, 1.6);
    // glowing cracks
    c.strokeStyle = f ? HEX.SAND : HEX.HFIRE; c.lineWidth = 1.8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(12, 30); c.lineTo(18, 34); c.lineTo(16, 42); c.moveTo(60, 30); c.lineTo(54, 35); c.lineTo(57, 44); c.moveTo(36, 17); c.lineTo(34, 23); c.stroke();
    // furnace mouth
    c.beginPath(); c.moveTo(22, 56); c.lineTo(22, 42); c.quadraticCurveTo(36, 28, 50, 42); c.lineTo(50, 56); c.closePath();
    c.fillStyle = HEX.WOOD_D; c.fill(); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
    c.save(); c.beginPath(); c.moveTo(24, 56); c.lineTo(24, 43); c.quadraticCurveTo(36, 32, 48, 43); c.lineTo(48, 56); c.clip();
    c.fillStyle = radial(c, 36, 54, 22, [[0, HEX.BONE], [0.35, HEX.HFIRE], [0.75, HEX.HFIRE], [1, HEX.HFIRE_D]]); c.fillRect(20, 30, 32, 28); c.restore();
    c.fillStyle = HEX.HULK_L; c.fillRect(20, 54, 32, 4); c.strokeStyle = OUT; c.lineWidth = 1.6; c.strokeRect(20, 54, 32, 4);
    // sparks
    const sp = f ? [[26, 4], [46, 2], [38, 11], [54, 8], [18, 12]] : [[30, 2], [42, 5], [48, 10], [24, 9], [58, 3]];
    for (const [x, y] of sp) { glowDot(c, x, y, 4, rgba(HEX.SAND, 0.9)); circle(c, x, y, 1.1, HEX.BONE); }
  });
  // Hearthstone — flat ring-shaped stone hearth, empty bowl
  make('hearthstone', 56, 48, (c) => {
    shadow(c, 28, 40, 26, 6);
    glowDot(c, 28, 26, 28, rgba(HEX.EMBER, 0.28));
    ellipse(c, 28, 30, 25, 13, HEX.SLATE, OUT, 2.8);
    ellipse(c, 28, 27, 25, 12, lin(c, 0, 15, 0, 39, [[0, HEX.SLATE_H], [1, HEX.SLATE_L]]), OUT, 2.5);
    c.strokeStyle = rgba(HEX.FROST_H, 0.7); c.lineWidth = 1.4; c.beginPath(); c.ellipse(28, 27, 23.5, 10.8, 0, Math.PI * 1.05, Math.PI * 1.75); c.stroke();
    ellipse(c, 28, 28, 15, 7.2, HEX.INK, OUT, 2.2);
    ellipse(c, 28, 30, 11, 4.4, HEX.INK);
    c.strokeStyle = HEX.EMBER; c.lineWidth = 1.2; c.beginPath(); c.ellipse(28, 28, 18.5, 9, 0, 0, TAU); c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; circle(c, 28 + Math.cos(a) * 21.5, 27 + Math.sin(a) * 10.2, 1.3, HEX.EMBER_L); }
    circle(c, 28, 29, 1.2, rgba(HEX.EMBER, 0.6));
  });
  // Frozen brazier — iron bowl, ice-blue flame (frame 1 slightly different glow)
  for (const f of [0, 1]) make('brazier' + f, 36, 48, (c) => {
    shadow(c, 18, 44, 14, 3.5);
    glowDot(c, 18, 20, f ? 24 : 19, f ? rgba(HEX.FROST_L, 0.65) : rgba(HEX.FROST, 0.5));
    c.strokeStyle = OUT; c.lineWidth = 5; c.lineCap = 'round';
    const legs = () => { c.beginPath(); c.moveTo(12, 28); c.lineTo(8, 44); c.moveTo(24, 28); c.lineTo(28, 44); c.moveTo(18, 30); c.lineTo(18, 45); c.stroke(); };
    legs(); c.strokeStyle = HEX.SLATE_L; c.lineWidth = 2.4; legs();
    // ice crystal flame
    for (const [x, h, w, lean] of [[13, 12, 4, -2], [18, 18 + f * 2, 5, 0], [23, 11, 4, 2]]) {
      poly(c, [[x + lean, 22 - h], [x + w, 22 - h * 0.3], [x + w * 0.6, 24], [x - w * 0.6, 24], [x - w, 22 - h * 0.3]], HEX.FROST_L, HEX.FROST_D, 1.5);
      poly(c, [[x + lean, 22 - h], [x + w, 22 - h * 0.3], [x, 22 - h * 0.2]], HEX.WHITE);
    }
    glowDot(c, 18, 18, f ? 8 : 6, rgba(HEX.WHITE, 0.9));
    c.beginPath(); c.moveTo(5, 24); c.quadraticCurveTo(7, 36, 18, 36); c.quadraticCurveTo(29, 36, 31, 24); c.closePath();
    c.fillStyle = lin(c, 5, 24, 31, 36, [[0, HEX.SLATE_L], [1, HEX.SLATE_D]]); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    ellipse(c, 18, 24, 13.5, 3.4, HEX.SLATE_L, OUT, 2);
    ellipse(c, 18, 24, 10, 2, HEX.FROST_L);
    c.strokeStyle = rgba(HEX.FROST_H, 0.8); c.lineWidth = 1.2; c.beginPath(); c.moveTo(8, 27); c.lineTo(10, 31); c.moveTo(27, 28); c.lineTo(25, 32); c.stroke();
    for (const [x, y] of [[9, 40], [27, 41], [14, 18 - f * 4], [24, 12 + f * 2]]) poly(c, [[x, y - 2.6], [x + 1.6, y], [x, y + 2.6], [x - 1.6, y]], HEX.FROST_H);
  });
  // Heartflame — living flame pickup
  make('heartflame', 24, 32, (c) => {
    glowDot(c, 12, 19, 16, rgba(HEX.EMBER, 0.8));
    c.beginPath(); c.moveTo(12, 30); c.bezierCurveTo(-1, 28, 1, 16, 8, 11); c.bezierCurveTo(8, 6, 11, 3, 13, 1); c.bezierCurveTo(14, 7, 17, 8, 19, 13); c.bezierCurveTo(24, 20, 24, 28, 12, 30);
    c.fillStyle = radial(c, 12, 24, 14, [[0, HEX.WHITE], [0.5, HEX.EMBER_L], [1, HEX.EMBER_D]]); c.fill();
    c.lineWidth = 2; c.strokeStyle = HEX.R_GOLD_D; c.stroke();
    c.beginPath(); c.moveTo(12, 28); c.bezierCurveTo(6, 27, 7, 21, 11, 17); c.bezierCurveTo(14, 20, 17, 22, 17, 25); c.bezierCurveTo(16, 28, 14, 28, 12, 28);
    c.fillStyle = HEX.WHITE; c.fill();
    ellipse(c, 8, 17, 1.6, 3.4, rgba(HEX.WHITE, 0.8));
  });
  // Ruined candle-chapel with a glowing doorway
  make('chapel', 64, 72, (c) => {
    shadow(c, 32, 67, 28, 5);
    glowDot(c, 32, 52, 30, rgba(HEX.EMBER_L, 0.55));
    poly(c, [[7, 66], [8, 28], [56, 26], [57, 66]], lin(c, 0, 26, 0, 66, [[0, HEX.SLATE_L], [1, HEX.SLATE_L]]), OUT, 2.6);
    // broken roof: gable with a bite taken out
    poly(c, [[3, 30], [24, 8], [32, 14], [38, 6], [61, 30]], HEX.SLATE, OUT, 2.6);
    poly(c, [[24, 8], [32, 14], [38, 6], [34, 20], [28, 18]], HEX.SLATE_D);
    c.strokeStyle = rgba(HEX.WHITE, 0.55); c.lineWidth = 1.4; c.beginPath(); c.moveTo(5, 30); c.lineTo(23, 10); c.stroke();
    // stones & cracks
    c.strokeStyle = rgba(HEX.INK, 0.55); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(10, 40); c.lineTo(20, 40); c.moveTo(44, 36); c.lineTo(54, 36); c.moveTo(48, 48); c.lineTo(55, 48); c.moveTo(14, 52); c.lineTo(22, 52); c.moveTo(46, 30); c.lineTo(48, 36); c.lineTo(45, 42); c.stroke();
    // glowing doorway
    c.beginPath(); c.moveTo(22, 66); c.lineTo(22, 44); c.quadraticCurveTo(32, 32, 42, 44); c.lineTo(42, 66); c.closePath();
    c.fillStyle = radial(c, 32, 56, 16, [[0, HEX.R_LIGHT], [0.5, HEX.EMBER_L], [1, HEX.EMBER_D]]); c.fill(); c.lineWidth = 2.6; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = HEX.R_LIGHT; c.lineWidth = 1.2; c.beginPath(); c.moveTo(24, 66); c.lineTo(24, 45); c.quadraticCurveTo(32, 35, 40, 45); c.lineTo(40, 66); c.stroke();
    poly(c, [[29, 66], [30, 54], [34, 54], [35, 66]], rgba(HEX.WOOD_D, 0.55));
    // tiny bell cross + candles
    c.strokeStyle = OUT; c.lineWidth = 3.6; c.beginPath(); c.moveTo(32, 15); c.lineTo(32, 4); c.moveTo(28, 8); c.lineTo(36, 8); c.stroke();
    c.strokeStyle = HEX.BONE; c.lineWidth = 1.6; c.stroke();
    for (const x of [12, 52]) {
      c.fillStyle = HEX.R_LIGHT; c.strokeStyle = OUT; c.lineWidth = 1.4; c.beginPath(); c.roundRect(x - 2, 56, 4, 8, 1); c.fill(); c.stroke();
      glowDot(c, x, 52, 7, rgba(HEX.EMBER_L, 0.95));
      c.beginPath(); c.moveTo(x, 56); c.quadraticCurveTo(x - 3, 52, x, 47); c.quadraticCurveTo(x + 3, 52, x, 56); c.fillStyle = HEX.EMBER_L; c.fill();
    }
    circle(c, 32, 22, 2, HEX.EMBER_H); glowDot(c, 32, 22, 6, rgba(HEX.EMBER_L, 0.7));
  });
  // Pilgrim — the Last Acolyte, small hooded traveller with a candle
  for (const f of [0, 1]) make('pilgrim' + f, 46, 50, (c) => {
    shadow(c, 23, 46, 13, 3.5);
    const w = f ? 2.5 : -2.5, bob = f ? -1 : 0;
    c.save(); c.translate(23, bob);
    c.beginPath(); c.moveTo(-12, 22); c.quadraticCurveTo(-14, 6, 0, 4); c.quadraticCurveTo(14, 6, 12, 22);
    c.lineTo(14, 42); c.lineTo(8, 40 + w * 0.5); c.lineTo(3, 45); c.lineTo(-2, 41 - w); c.lineTo(-8, 45); c.lineTo(-14, 41); c.closePath();
    c.fillStyle = lin(c, 0, 4, 0, 46, [[0, HEX.WOOD_L], [1, HEX.WOOD]]); c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = HEX.BONE; c.fillRect(-10, 25, 20, 3); c.strokeStyle = OUT; c.lineWidth = 1; c.strokeRect(-10, 25, 20, 3);
    c.strokeStyle = rgba(HEX.WOOD_D, 0.5); c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4, 30); c.lineTo(-5, 39); c.moveTo(5, 30); c.lineTo(5 + w * 0.3, 38); c.stroke();
    // hood + warm face
    c.beginPath(); c.moveTo(-11, 19); c.bezierCurveTo(-13, -1, 13, -1, 11, 19); c.quadraticCurveTo(0, 23, -11, 19);
    c.fillStyle = HEX.SAND; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
    ellipse(c, 0, 13, 7, 7, HEX.WOOD_D);
    ellipse(c, 0, 15, 5.2, 4.6, HEX.SKIN);
    bigEye(c, -2.6, 13, HEX.R_GOLD_D, 1.9, 2.4); bigEye(c, 2.6, 13, HEX.R_GOLD_D, 1.9, 2.4);
    blush(c, -4.5, 17); blush(c, 4.5, 17);
    // arm + candle
    c.strokeStyle = HEX.WOOD_L; c.lineWidth = 4.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(8, 22); c.lineTo(15, 25); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = HEX.R_LIGHT; c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.roundRect(14, 21, 5, 9, 1.5); c.fill(); c.stroke();
    glowDot(c, 16.5, 14 - f, 12 + f * 2, rgba(HEX.EMBER_L, 0.95));
    c.beginPath(); c.moveTo(16.5, 21); c.quadraticCurveTo(12 + f * 2, 15, 16.5 + w * 0.3, 8 - f * 2); c.quadraticCurveTo(21, 15, 16.5, 21);
    c.fillStyle = HEX.EMBER_L; c.fill();
    c.beginPath(); c.moveTo(16.5, 20); c.quadraticCurveTo(14.5, 16, 16.5, 12.5 - f); c.quadraticCurveTo(18.5, 16, 16.5, 20); c.fillStyle = HEX.EMBER_H; c.fill();
    c.restore();
  });
  // Sun shard pickup
  make('sunshard', 24, 24, (c) => {
    glowDot(c, 12, 12, 12, rgba(HEX.R_GOLD, 0.85));
    const pts = [[12, 1.5], [19, 9], [15.5, 22], [8.5, 22], [5, 9]];
    poly(c, pts, lin(c, 4, 2, 20, 22, [[0, HEX.R_LIGHT], [0.5, HEX.R_GOLD], [1, HEX.EMBER]]));
    poly(c, [[12, 1.5], [19, 9], [12, 11]], rgba(HEX.WHITE, 0.8));
    poly(c, [[12, 11], [5, 9], [8.5, 22]], rgba(HEX.EMBER_D, 0.45));
    poly(c, pts); rim(c, rgba(HEX.R_LIGHT, 0.95), HEX.R_GOLD_D, 1.8);
    circle(c, 12, 12, 2.2, HEX.WHITE);
  });
  // Sunbearer — golden scarab carrying a glowing sun disc (enemy texture)
  for (const f of [0, 1]) make('sunbearer' + f, 40, 40, (c) => {
    shadow(c, 20, 36, 14, 4);
    c.translate(0, -3);
    glowDot(c, 20, 15, 18, rgba(HEX.R_GOLD, 0.7));
    c.lineCap = 'round';
    for (const s of [-1, 1]) for (const [y, dy] of [[26, 6], [30, 8], [33, 9]]) {
      const k = f ? -2 : 2;
      c.strokeStyle = OUT; c.lineWidth = 3.6; c.beginPath(); c.moveTo(20 + s * 8, y); c.lineTo(20 + s * 15, y + dy * 0.3 + k * s); c.lineTo(20 + s * 17, y + dy); c.stroke();
      c.strokeStyle = HEX.EMBER_L; c.lineWidth = 1.8; c.stroke();
    }
    // body
    ellipse(c, 20, 27, 13, 9, lin(c, 0, 18, 0, 36, [[0, HEX.R_GOLD], [1, HEX.R_BRONZE]]), OUT, 2.5);
    c.strokeStyle = rgba(HEX.R_GOLD_D, 0.7); c.lineWidth = 1.4; c.beginPath(); c.moveTo(20, 19); c.lineTo(20, 35); c.stroke();
    ellipse(c, 14, 24, 3.4, 2, rgba(HEX.EMBER_H, 0.55));
    // head + horns
    ellipse(c, 20, 36, 6, 3.6, HEX.R_BRONZE, OUT, 2);
    poly(c, [[16, 36], [13, 32], [18, 34]], HEX.EMBER_H, OUT, 1.2); poly(c, [[24, 36], [27, 32], [22, 34]], HEX.EMBER_H, OUT, 1.2);
    eye(c, 17.5, 36, 1.3, HEX.EMBER); eye(c, 22.5, 36, 1.3, HEX.EMBER);
    // sun disc on back
    glowDot(c, 20, 14, 14, rgba(HEX.EMBER_L, 0.95));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + f * 0.13; poly(c, [[20 + Math.cos(a - 0.14) * 9, 15 + Math.sin(a - 0.14) * 9], [20 + Math.cos(a) * 14, 15 + Math.sin(a) * 14], [20 + Math.cos(a + 0.14) * 9, 15 + Math.sin(a + 0.14) * 9]], HEX.R_GOLD, HEX.R_GOLD_D, 1); }
    circle(c, 20, 15, 9, radial(c, 18, 13, 10, [[0, HEX.WHITE], [0.6, HEX.EMBER_L], [1, HEX.EMBER]]), HEX.R_GOLD_D, 1.8);
  });
  // Lighthouse — tall stone tower, glowing lantern room
  make('lighthouse', 64, 120, (c) => {
    shadow(c, 32, 112, 28, 6);
    glowDot(c, 32, 20, 32, rgba(HEX.EMBER_L, 0.6));
    for (const [x, y, r] of [[10, 110, 8], [52, 111, 7], [22, 114, 6]]) { poly(c, [[x - r, y + 3], [x - r * 0.6, y - r * 0.7], [x + r * 0.3, y - r], [x + r, y + 3]], HEX.SLATE, OUT, 2); }
    // tower with stripes
    c.beginPath(); c.moveTo(14, 112); c.lineTo(22, 38); c.lineTo(42, 38); c.lineTo(50, 112); c.closePath();
    c.save(); c.clip();
    c.fillStyle = lin(c, 14, 0, 50, 0, [[0, HEX.BONE], [0.55, HEX.SLATE_H], [1, HEX.SLATE_L]]); c.fillRect(0, 30, 64, 90);
    c.fillStyle = HEX.CRIMSON; for (const y of [50, 74, 98]) c.fillRect(0, y, 64, 12);
    c.fillStyle = rgba(HEX.INK, 0.12); c.fillRect(38, 30, 20, 90);
    c.restore();
    c.beginPath(); c.moveTo(14, 112); c.lineTo(22, 38); c.lineTo(42, 38); c.lineTo(50, 112); c.closePath(); c.lineWidth = 2.8; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = rgba(HEX.WHITE, 0.7); c.lineWidth = 1.4; c.beginPath(); c.moveTo(18, 104); c.lineTo(24, 42); c.stroke();
    c.fillStyle = HEX.INK; c.beginPath(); c.roundRect(28, 94, 8, 16, [4, 4, 0, 0]); c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
    ellipse(c, 32, 62, 2.6, 3.6, HEX.INK, OUT, 1.4); ellipse(c, 32, 84, 2.6, 3.6, HEX.INK, OUT, 1.4);
    // gallery
    c.fillStyle = HEX.SLATE_D; c.beginPath(); c.roundRect(15, 33, 34, 7, 2); c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = HEX.SLATE_L; c.lineWidth = 1.2; c.beginPath(); for (let x = 18; x < 48; x += 5) { c.moveTo(x, 33); c.lineTo(x, 28); } c.moveTo(17, 28); c.lineTo(47, 28); c.stroke();
    // lantern room
    c.fillStyle = radial(c, 32, 20, 14, [[0, HEX.WHITE], [0.45, HEX.EMBER_H], [1, HEX.EMBER]]);
    c.beginPath(); c.roundRect(20, 9, 24, 20, 3); c.fill(); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = HEX.SLATE_D; c.lineWidth = 2; c.beginPath(); c.moveTo(26, 9); c.lineTo(26, 29); c.moveTo(38, 9); c.lineTo(38, 29); c.stroke();
    glowDot(c, 32, 19, 10, HEX.WHITE);
    poly(c, [[17, 10], [32, -0.5], [47, 10]], HEX.CRIMSON, OUT, 2.4);
    circle(c, 32, 1.5, 2, HEX.EMBER_L, OUT, 1.2);
    // light beams
    c.fillStyle = rgba(HEX.EMBER_H, 0.35); poly(c, [[20, 17], [-2, 12], [-2, 24]]); poly(c, [[44, 17], [66, 12], [66, 24]]);
  });
  // Rot pool — subtle murky green rim decal
  make('rotpool', 64, 32, (c) => {
    c.fillStyle = radial(c, 32, 17, 32, [[0, rgba(HEX.OBJ_D, 0.35)], [1, rgba(HEX.OBJ_D, 0)]]); c.beginPath(); c.ellipse(32, 17, 32, 15, 0, 0, TAU); c.fill();
    ellipse(c, 32, 17, 28, 12, rgba(HEX.OBJ_D, 0.7), rgba(HEX.INK, 0.75), 2);
    ellipse(c, 32, 17, 22, 8.5, rgba(HEX.OBJ_D, 0.65));
    ellipse(c, 28, 16, 12, 4, rgba(HEX.OBJ, 0.28));
    c.strokeStyle = rgba(HEX.OBJ, 0.35); c.lineWidth = 1; c.beginPath(); c.ellipse(32, 17, 26, 10.5, 0, Math.PI * 1.1, Math.PI * 1.8); c.stroke();
    for (const [x, y, r] of [[22, 15, 2.2], [40, 19, 1.8], [33, 13, 1.4], [47, 14, 1.2]]) circle(c, x, y, r, rgba(HEX.OBJ, 0.45), rgba(HEX.INK, 0.5), 0.8);
  });
}

function drawNewScenery() {
  const dm = (name, w, h, draw) => { make(name, w, h, draw); dimFrame(name, 0.12, 0.86); };
  // ---- Stormbreak Coast ----
  dm('cliffrock', 40, 34, (c) => {
    shadow(c, 20, 30, 17, 4);
    poly(c, [[3, 30], [6, 14], [14, 5], [22, 8], [30, 3], [37, 16], [37, 30]], HEX.SLATE, OUT, 2.2);
    poly(c, [[14, 5], [22, 8], [30, 3], [26, 13], [16, 14]], HEX.SLATE_L);
    c.strokeStyle = HEX.SLATE_D; c.lineWidth = 1.2; c.beginPath(); c.moveTo(10, 28); c.lineTo(12, 18); c.moveTo(26, 28); c.lineTo(24, 18); c.stroke();
    ellipse(c, 12, 29, 6, 2, rgba(HEX.SPIRIT, 0.4));
  });
  dm('wreck', 56, 34, (c) => {
    shadow(c, 28, 30, 25, 4);
    c.beginPath(); c.moveTo(3, 30); c.quadraticCurveTo(4, 14, 14, 9); c.lineTo(46, 12); c.quadraticCurveTo(54, 18, 53, 30); c.closePath();
    c.fillStyle = lin(c, 0, 9, 0, 30, [[0, HEX.WOOD], [1, HEX.WOOD_D]]); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = rgba(HEX.INK, 0.7); c.lineWidth = 1.3; c.beginPath(); for (const y of [16, 22]) { c.moveTo(6, y); c.lineTo(50, y + 1); } c.stroke();
    for (const x of [18, 30, 42]) { c.fillStyle = HEX.WOOD; c.fillRect(x, 8 - (x === 30 ? 6 : 0), 3, 14); }
    c.strokeStyle = OUT; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(33, 3); c.lineTo(46, -1); c.stroke();
    c.strokeStyle = HEX.WOOD; c.lineWidth = 1.6; c.stroke();
    poly(c, [[9, 30], [14, 22], [20, 30]], rgba(HEX.MOSS_L, 0.6));
    for (const [x, y] of [[22, 13], [34, 14]]) circle(c, x, y, 1.5, HEX.WOOD_L);
  });
  dm('tidepool', 40, 22, (c) => {
    ellipse(c, 20, 12, 18, 8, rgba(HEX.SLATE_D, 0.55), rgba(HEX.INK, 0.7), 1.8);
    ellipse(c, 20, 12, 13, 5, rgba(HEX.FROST_D, 0.5));
    ellipse(c, 16, 11, 6, 1.8, rgba(HEX.FROST_L, 0.3));
    circle(c, 31, 8, 1.8, HEX.WOOD_L, OUT, 0.8); circle(c, 8, 14, 1.4, HEX.HULK_L);
  });
  dm('kelp', 28, 36, (c) => {
    c.lineCap = 'round';
    for (const [x, h, col] of [[8, 26, HEX.MOSS], [14, 32, HEX.MOSS_L], [20, 24, HEX.MOSS]]) {
      c.strokeStyle = OUT; c.lineWidth = 5; c.beginPath(); c.moveTo(x, 34); c.bezierCurveTo(x - 6, 34 - h * 0.4, x + 6, 34 - h * 0.7, x - 1, 34 - h); c.stroke();
      c.strokeStyle = col; c.lineWidth = 3; c.stroke();
    }
    for (const [x, y] of [[6, 18], [22, 20], [12, 8]]) circle(c, x, y, 2, HEX.MOSS_L, OUT, 1);
    ellipse(c, 14, 34, 10, 2.4, HEX.SLATE_D, OUT, 1.4);
  });
  dm('lightrod', 20, 60, (c) => {
    shadow(c, 10, 56, 8, 2.5);
    c.strokeStyle = OUT; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(10, 56); c.lineTo(10, 8); c.stroke();
    c.strokeStyle = HEX.WOOD; c.lineWidth = 2.4; c.stroke();
    c.strokeStyle = HEX.WOOD_L; c.lineWidth = 1; c.beginPath(); c.moveTo(9.2, 54); c.lineTo(9.2, 12); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 3.6; c.beginPath(); c.moveTo(4, 24); c.lineTo(16, 20); c.moveTo(5, 34); c.lineTo(15, 31); c.stroke();
    c.strokeStyle = HEX.WOOD; c.lineWidth = 1.6; c.stroke();
    poly(c, [[10, 0], [12.4, 9], [7.6, 9]], HEX.SLATE_H, OUT, 1.4);
    poly(c, [[5, 56], [8, 50], [12, 50], [15, 56]], HEX.SLATE_D, OUT, 1.8);
    glowDot(c, 10, 2, 7, rgba(HEX.FROST, 0.7));
  });
  // ---- Wayfarer's March ----
  dm('milestone', 24, 40, (c) => {
    shadow(c, 12, 36, 10, 3);
    poly(c, [[4, 36], [5, 14], [9, 6], [16, 6], [20, 14], [20, 36]], HEX.SLATE_L, OUT, 2.2);
    poly(c, [[5, 14], [9, 6], [16, 6], [13, 13]], HEX.SLATE_L);
    c.strokeStyle = HEX.SLATE_D; c.lineWidth = 1.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(9, 20); c.lineTo(15, 20); c.moveTo(9, 25); c.lineTo(15, 25); c.moveTo(9, 30); c.lineTo(13, 30); c.stroke();
    ellipse(c, 7, 36, 5, 1.8, rgba(HEX.BOG_D, 0.55));
  });
  dm('signpost', 28, 44, (c) => {
    shadow(c, 14, 40, 10, 3);
    c.strokeStyle = OUT; c.lineWidth = 5.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(14, 41); c.lineTo(14, 4); c.stroke();
    c.strokeStyle = HEX.WOOD; c.lineWidth = 3; c.stroke();
    poly(c, [[5, 8], [21, 8], [26, 12], [21, 16], [5, 16]], HEX.WOOD_L, OUT, 2);
    poly(c, [[7, 22], [22, 22], [22, 30], [7, 30], [3, 26]], HEX.WOOD_L, OUT, 2);
    c.strokeStyle = HEX.WOOD_D; c.lineWidth = 1.2; c.beginPath(); c.moveTo(8, 12); c.lineTo(18, 12); c.moveTo(10, 26); c.lineTo(19, 26); c.stroke();
    circle(c, 7, 12, 1, HEX.SAND); circle(c, 20, 26, 1, HEX.SAND);
  });
}

// Storm kite enemy — crackling storm ray, 2-frame flap
function drawExtraEnemies() {
  for (const f of [0, 1]) make('stormkite' + f, 40, 40, (c) => {
    shadow(c, 20, 37, 11 * SHADOW.floatWidth, 3 * SHADOW.floatWidth, SHADOW.floatAlpha);
    glowDot(c, 20, 18, 20, rgba(HEX.FROST, 0.4));
    c.save(); c.translate(20, 17);
    const wy = f ? 0.6 : 1, tail = f ? 3 : -3;
    // tail
    c.strokeStyle = OUT; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 8); c.quadraticCurveTo(tail * 2, 14, tail, 19); c.stroke();
    c.strokeStyle = HEX.FROST; c.lineWidth = 1.8; c.stroke();
    poly(c, [[tail - 3, 19], [tail, 15], [tail + 3, 19]], HEX.FROST_L, OUT, 1.2);
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, wy);
      c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(14, -16, 19, -2); c.quadraticCurveTo(12, 1, 0, 9); c.closePath();
      c.fillStyle = lin(c, 0, -10, 18, 6, [[0, HEX.GLOOM_D], [1, HEX.GLOOM_D]]); c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
      c.strokeStyle = HEX.FROST_L; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3, -3); c.lineTo(10, -6); c.lineTo(8, -2); c.lineTo(15, -3); c.stroke();
      c.restore();
    }
    poly(c, [[0, -9], [6, 0], [0, 10], [-6, 0]], lin(c, -6, -9, 6, 10, [[0, HEX.GLOOM_L], [1, HEX.GLOOM_D]]), OUT, 2.2);
    ellipse(c, -2, -3, 1.8, 3.6, rgba(HEX.WHITE, 0.4));
    eye(c, -2.6, -1, 1.5, HEX.HGLARE); eye(c, 2.6, -1, 1.5, HEX.HGLARE);
    c.restore();
    c.strokeStyle = HEX.BONE; c.lineWidth = 1.5; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(5, 4 + f * 2); c.lineTo(9, 9); c.lineTo(6, 10); c.lineTo(10, 16); c.stroke();
    glowDot(c, 33, 10 + f * 4, 3, HEX.BOG_L); glowDot(c, 6, 26 - f * 3, 2.6, HEX.BOG_L);
  });
}

// ---------- new Bearers ----------
function drawNewBearers() {
  // Wren — the Wayfarer: windblown teal-and-sand cloak, wide-brim hat, staff with hanging lantern, satchel, boots
  makeChar('wren', (c) => {
    shadow(c, 32, 59, 15, 5);
    // windblown cloak tail
    c.fillStyle = HEX.OBJ_D; c.strokeStyle = OUT; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(25, 33); c.quadraticCurveTo(10, 34 + STEP * 2, 1, 46 - STEP * 3); c.lineTo(5, 53 - STEP * 2); c.quadraticCurveTo(13, 46, 26, 46); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = HEX.EMBER_H; c.lineWidth = 1.4; c.beginPath(); c.moveTo(4, 50 - STEP * 2); c.quadraticCurveTo(12, 44, 24, 44); c.stroke();
    boots(c, 32, HEX.WOOD, HEX.WOOD_D);
    poly(c, [[21, 52], [24, 33], [40, 33], [43, 52]], HEX.OBJ_D, OUT, 2.5);
    poly(c, [[27, 52], [28, 36], [36, 36], [37, 52]], HEX.EMBER_H);
    c.fillStyle = HEX.WOOD; c.fillRect(22, 44, 20, 3);
    // satchel
    c.fillStyle = HEX.WOOD_L; c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.roundRect(37, 41, 12, 11, 3); c.fill(); c.stroke();
    c.fillStyle = HEX.R_BRONZE; c.fillRect(38, 41, 10, 4); circle(c, 43, 46, 1.4, HEX.EMBER_H);
    c.strokeStyle = HEX.WOOD; c.lineWidth = 2; c.beginPath(); c.moveTo(25, 34); c.lineTo(40, 42); c.stroke();
    // head
    circle(c, 32, 23, 12, HEX.SKIN, OUT, 2.5);
    c.fillStyle = HEX.R_GOLD_D; c.beginPath(); c.moveTo(20, 24); c.quadraticCurveTo(21, 15, 32, 15); c.quadraticCurveTo(43, 15, 44, 24); c.quadraticCurveTo(40, 19, 32, 19); c.quadraticCurveTo(24, 19, 20, 24); c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
    bigEye(c, 27.5, 25, HEX.OBJ_D, 3.2, 4.2); bigEye(c, 36.5, 25, HEX.OBJ_D, 3.2, 4.2);
    blush(c, 22.5, 30); blush(c, 41.5, 30); smile(c, 32, 30, 2.4);
    // wide-brim hat
    ellipse(c, 32, 16, 22, 5.6, HEX.SAND, OUT, 2.5);
    c.beginPath(); c.moveTo(21, 15); c.bezierCurveTo(21, 3, 43, 3, 43, 15); c.quadraticCurveTo(32, 19, 21, 15);
    c.fillStyle = HEX.SAND; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = HEX.MOSS; c.fillRect(22, 11, 20, 3.6);
    poly(c, [[38, 10], [44, 3], [42, 12]], HEX.EMBER_D, OUT, 1.2);
    // staff + hanging lantern
    c.strokeStyle = OUT; c.lineWidth = 4.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(9, 58); c.lineTo(10, 14); c.stroke();
    c.strokeStyle = HEX.WOOD_L; c.lineWidth = 2.4; c.stroke();
    c.strokeStyle = HEX.WOOD; c.lineWidth = 1.4; c.beginPath(); c.moveTo(10, 14); c.quadraticCurveTo(15, 10, 17, 16); c.stroke();
    glowDot(c, 17 + STEP * 0.6, 24, 12, rgba(HEX.EMBER_L, 0.9));
    c.fillStyle = HEX.WOOD_L; c.strokeStyle = OUT; c.lineWidth = 1.8; c.beginPath(); c.roundRect(13.5 + STEP * 0.6, 17, 7, 10, 2); c.fill(); c.stroke();
    ellipse(c, 17 + STEP * 0.6, 22, 2.2, 3.2, HEX.EMBER_H);
    circle(c, 12, 39, 3, HEX.SKIN, OUT, 1.6);
  });
  // Mordrel — the Pactbound: gaunt scholar-priest, crimson-and-black coat, contract scrolls + chains, pact brand
  makeChar('mordrel', (c) => {
    shadow(c, 32, 59, 15, 5);
    // orbiting scrolls behind
    const orb = (x, y, rot) => {
      c.save(); c.translate(x, y + STEP * 0.8); c.rotate(rot);
      glowDot(c, 0, 0, 10, rgba(HEX.CRIMSON, 0.7));
      c.fillStyle = HEX.BONE; c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.roundRect(-3.6, -7, 7.2, 14, 1.6); c.fill(); c.stroke();
      c.fillStyle = HEX.CRIMSON; c.fillRect(-4.4, -7.6, 8.8, 2.4); c.fillRect(-4.4, 5.2, 8.8, 2.4);
      c.strokeStyle = HEX.CRIMSON; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-1.8, -3); c.lineTo(1.8, -3); c.moveTo(-1.8, 0); c.lineTo(1.8, 0); c.moveTo(-1.8, 3); c.lineTo(0.6, 3); c.stroke();
      c.restore();
    };
    orb(7, 24, -0.3); orb(56, 20, 0.3); orb(55, 44, -0.15);
    boots(c, 32, HEX.INK, HEX.INK);
    // long black-and-crimson coat
    poly(c, [[19, 54], [22, 33], [42, 33], [45, 54]], HEX.WOOD_D, OUT, 2.5);
    poly(c, [[26, 54], [28, 36], [36, 36], [38, 54]], HEX.CRIMSON);
    c.strokeStyle = HEX.CRIMSON; c.lineWidth = 1.2; c.beginPath(); c.moveTo(32, 36); c.lineTo(32, 54); c.stroke();
    for (const y of [40, 46]) circle(c, 29.5, y, 1.1, HEX.EMBER_L);
    c.fillStyle = HEX.INK; c.fillRect(21, 44, 22, 3.4);
    // hanging chains at belt
    c.strokeStyle = HEX.SLATE_H; c.lineWidth = 1.8; c.setLineDash([2.4, 1.8]);
    c.beginPath(); c.moveTo(24, 46); c.quadraticCurveTo(21 - STEP * 2, 54, 25 - STEP * 3, 59); c.moveTo(40, 46); c.quadraticCurveTo(44 + STEP * 2, 54, 40 + STEP * 3, 59); c.stroke(); c.setLineDash([]);
    circle(c, 25 - STEP * 3, 59, 1.7, HEX.FROST_H, OUT, 1); circle(c, 40 + STEP * 3, 59, 1.7, HEX.FROST_H, OUT, 1);
    // high collar
    poly(c, [[21, 34], [24, 26], [30, 34]], HEX.INK, OUT, 1.8); poly(c, [[43, 34], [40, 26], [34, 34]], HEX.INK, OUT, 1.8);
    // head: pale, gaunt
    c.beginPath(); c.moveTo(20, 20); c.quadraticCurveTo(20, 6, 32, 6); c.quadraticCurveTo(44, 6, 44, 20); c.quadraticCurveTo(43, 33, 32, 36); c.quadraticCurveTo(21, 33, 20, 20);
    c.fillStyle = HEX.FROST_H; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    ellipse(c, 24.5, 30, 3, 1.4, rgba(HEX.SLATE_L, 0.35)); ellipse(c, 39.5, 30, 3, 1.4, rgba(HEX.SLATE_L, 0.35));
    // slicked black hair with crimson streak
    c.fillStyle = HEX.INK; c.beginPath(); c.moveTo(19, 20); c.bezierCurveTo(16, 2, 48, 2, 45, 20); c.quadraticCurveTo(42, 11, 36, 12); c.lineTo(30, 9); c.quadraticCurveTo(22, 11, 19, 20); c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = HEX.CRIMSON; c.lineWidth = 1.6; c.beginPath(); c.moveTo(33, 5); c.quadraticCurveTo(36, 8, 36, 12); c.stroke();
    // ember eyes
    glowDot(c, 27, 22, 8, rgba(HEX.EMBER_D, 0.5)); glowDot(c, 37, 22, 8, rgba(HEX.EMBER_D, 0.5));
    ellipse(c, 27, 22, 3.4, 4.2, HEX.WHITE, OUT, 1.5); ellipse(c, 37, 22, 3.4, 4.2, HEX.WHITE, OUT, 1.5);
    ellipse(c, 27.3, 22.6, 2.4, 3.1, HEX.EMBER_D); ellipse(c, 37.3, 22.6, 2.4, 3.1, HEX.EMBER_D);
    circle(c, 27.4, 23, 1.2, HEX.WOOD_D); circle(c, 37.4, 23, 1.2, HEX.WOOD_D); circle(c, 26.2, 20.8, 1.1, HEX.WHITE); circle(c, 36.2, 20.8, 1.1, HEX.WHITE);
    c.strokeStyle = OUT; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(23, 17.5); c.lineTo(30, 18.5); c.moveTo(41, 17.5); c.lineTo(34, 18.5); c.stroke();
    c.beginPath(); c.moveTo(29, 31); c.quadraticCurveTo(32, 32.4, 35, 31); c.stroke();
    // hand with pact-sigil brand
    circle(c, 15, 44 + STEP * 0.6, 4, HEX.FROST_H, OUT, 1.8);
    glowDot(c, 15, 44 + STEP * 0.6, 7, rgba(HEX.CRIMSON, 0.9));
    poly(c, star(15, 44 + STEP * 0.6, 3.2, 1.3, 5, -Math.PI / 2), HEX.CRIMSON);
    c.strokeStyle = HEX.WOOD_D; c.lineWidth = 4; c.beginPath(); c.moveTo(21, 38); c.lineTo(17, 42); c.stroke();
  });
}

// ---------- digits for damage numbers ----------
function drawDigits() {
  const chars = '0123456789!';
  for (const ch of chars) {
    make('d' + ch, 18, 24, (c) => {
      c.font = '700 22px "Chakra Petch", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 5; c.strokeStyle = HEX.INK; c.lineJoin = 'round';
      c.strokeText(ch, 9, 13); c.fillStyle = HEX.WHITE; c.fillText(ch, 9, 13);
    });
  }
}

// ---------- weapon/passive icons (atlas regions reused for HTML UI) ----------
function iconBG(c, col) {
  c.fillStyle = radial(c, 24, 24, 30, [[0, col], [1, HEX.PANEL]]);
  c.beginPath(); c.roundRect(1, 1, 46, 46, 8); c.fill();
}
function drawIcons() {
  const I = (name, col, fn) => make('icon_' + name, 48, 48, (c) => { iconBG(c, col); c.save(); fn(c); c.restore(); });
  const blit = (c, frame, x, y, s = 1, rot = 0) => {
    const f = frames[frame];
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.drawImage(atlasCanvas, f.x * SS, f.y * SS, f.w * SS, f.h * SS, -f.w / 2, -f.h / 2, f.w, f.h);
    c.restore();
  };
  // weapons
  I('emberBolt', HEX.HFIRE_D, (c) => { blit(c, 'bolt', 30, 18, 0.9); blit(c, 'bolt', 18, 30, 1.1); });
  I('haloBlades', HEX.FROST_D, (c) => { blit(c, 'blade', 16, 16, 0.8, 0); blit(c, 'blade', 32, 32, 0.8, 3); c.strokeStyle = rgba(HEX.FROST_L, 0.5); c.lineWidth = 2; c.beginPath(); c.arc(24, 24, 13, 0, TAU); c.stroke(); });
  I('stormCoil', HEX.GLOOM_D, (c) => { c.strokeStyle = HEX.FROST_L; c.lineWidth = 3; c.shadowColor = HEX.R_BLUE; c.shadowBlur = 8; c.beginPath(); c.moveTo(28, 6); c.lineTo(16, 24); c.lineTo(26, 24); c.lineTo(18, 42); c.stroke(); });
  I('frostPulse', HEX.FROST_D, (c) => { blit(c, 'freeze', 24, 24, 1.1); c.strokeStyle = rgba(HEX.FROST_L, 0.7); c.lineWidth = 2; c.beginPath(); c.arc(24, 24, 19, 0, TAU); c.stroke(); });
  I('wispSwarm', HEX.SPIRIT_D, (c) => { blit(c, 'wisp', 16, 30); blit(c, 'wisp', 30, 16); blit(c, 'wisp', 32, 32, 0.7); });
  I('crescentArc', HEX.HEYE_D, (c) => { blit(c, 'slash', 26, 24, 0.33); });
  I('starfall', HEX.HFIRE_D, (c) => { blit(c, 'meteor', 22, 26, 0.9); blit(c, 'spark', 36, 12, 0.7); });
  I('moonglaive', HEX.GLOOM_D, (c) => { blit(c, 'glaive', 24, 24, 0.85); });
  I('prismBeam', HEX.ROSE_D, (c) => { const cols = [HEX.HEYE, HEX.EMBER_L, HEX.R_GREEN, HEX.FROST]; cols.forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(8, 40 - i * 3); c.lineTo(42, 10 + i * 4); c.stroke(); }); circle(c, 10, 38, 5, HEX.WHITE); });
  I('bloomMines', HEX.ROSE_D, (c) => { blit(c, 'mine', 24, 24, 1.1); });
  I('sparkDrones', HEX.MOSS_D, (c) => { blit(c, 'drone', 24, 24, 1.05); });
  I('sunRing', HEX.R_GOLD_D, (c) => { c.strokeStyle = HEX.EMBER_L; c.lineWidth = 4; c.setLineDash([6, 4]); c.beginPath(); c.arc(24, 24, 15, 0, TAU); c.stroke(); glowDot(c, 24, 24, 10, rgba(HEX.EMBER, 0.9)); });
  I('iceLance', HEX.SLATE_D, (c) => { blit(c, 'icicle', 24, 24, 1.3, -0.7); blit(c, 'icicle', 18, 32, 0.9, -0.7); });
  I('sanctum', HEX.R_GOLD_D, (c) => { blit(c, 'feather', 24, 18, 1); blit(c, 'feather', 22, 30, 1, 0.4); });
  I('gravewell', HEX.ROSE_D, (c) => { blit(c, 'vortex', 24, 24, 0.36); });
  // fusions
  I('cataclysm', HEX.HFIRE_D, (c) => { blit(c, 'meteor', 24, 24, 1.05); blit(c, 'bolt', 34, 14, 0.8); blit(c, 'bolt', 12, 34, 0.7); });
  I('thousandEdges', HEX.FROST_D, (c) => { for (let i = 0; i < 6; i++) blit(c, 'blade', 24 + Math.cos(i) * 13, 24 + Math.sin(i) * 13, 0.55, i); });
  I('tempestHeart', HEX.GLOOM_D, (c) => { blit(c, 'freeze', 24, 24, 1); c.strokeStyle = HEX.WHITE; c.lineWidth = 2.5; c.beginPath(); c.moveTo(34, 4); c.lineTo(26, 20); c.lineTo(34, 20); c.lineTo(24, 40); c.stroke(); });
  I('seraphChoir', HEX.GLOOM_D, (c) => { blit(c, 'wisp', 24, 24, 1.4); c.strokeStyle = HEX.WHITE; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(24 + Math.cos(a) * 9, 24 + Math.sin(a) * 9); c.lineTo(24 + Math.cos(a) * 21, 24 + Math.sin(a) * 21); c.stroke(); } });
  I('eclipseDisc', HEX.ROSE_D, (c) => { circle(c, 24, 24, 15, HEX.INK, HEX.EMBER_L, 3); blit(c, 'glaive', 24, 24, 0.6); });
  I('hiveFoundry', HEX.WOOD, (c) => { blit(c, 'drone', 30, 18, 0.9); blit(c, 'mine', 16, 32, 0.8); });
  I('glacierSpire', HEX.FROST_D, (c) => { for (let i = 0; i < 5; i++) blit(c, 'icicle', 24, 24, 1, (i / 5) * TAU); });
  I('eventHorizon', HEX.PANEL, (c) => { blit(c, 'vortex', 24, 26, 0.34); blit(c, 'meteor', 32, 14, 0.55); blit(c, 'meteor', 13, 16, 0.4); });
  // passives
  I('might', HEX.HFIRE_D, (c) => { glowDot(c, 24, 24, 18, rgba(HEX.HFIRE, 0.9)); poly(c, [[24, 10], [33, 24], [24, 38], [15, 24]], HEX.R_BRONZE, OUT, 2); });
  I('haste', HEX.SLATE_D, (c) => { circle(c, 24, 24, 14, HEX.FROST_L, OUT, 2.5); c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.moveTo(24, 24); c.lineTo(24, 14); c.moveTo(24, 24); c.lineTo(31, 28); c.stroke(); });
  I('reach', HEX.SLATE_D, (c) => { circle(c, 24, 24, 15, rgba(HEX.FROST_L, 0.25), HEX.FROST_L, 2.5); circle(c, 24, 24, 7, HEX.FROST_H, OUT, 2); });
  I('velocity', HEX.SLATE, (c) => { blit(c, 'feather', 24, 24, 1.2, -0.6); });
  I('multicast', HEX.GLOOM_D, (c) => { poly(c, [[24, 6], [34, 24], [24, 42], [14, 24]], HEX.MOON, OUT, 2); poly(c, [[24, 6], [34, 24], [24, 24]], HEX.WHITE); });
  I('vitality', HEX.WOOD, (c) => { blit(c, 'heart', 24, 25, 1.3); });
  I('regen', HEX.BOG_D, (c) => { c.fillStyle = HEX.R_GREEN; c.fillRect(20, 10, 8, 28); c.fillRect(10, 20, 28, 8); });
  I('swift', HEX.WOOD_D, (c) => { poly(c, [[12, 34], [16, 14], [26, 14], [26, 28], [36, 30], [36, 36], [12, 36]], HEX.WOOD_L, OUT, 2); c.strokeStyle = HEX.WHITE; c.lineWidth = 2; c.beginPath(); c.moveTo(4, 20); c.lineTo(12, 20); c.moveTo(2, 28); c.lineTo(10, 28); c.stroke(); });
  I('magnet', HEX.SHROUD_D, (c) => { blit(c, 'magnet', 24, 24, 1.3); });
  I('luck', HEX.BOG_D, (c) => { for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.78; circle(c, 24 + Math.cos(a) * 7, 24 + Math.sin(a) * 7, 7, HEX.R_GREEN, OUT, 2); } circle(c, 24, 24, 3, HEX.BOG_D); });
  I('crit', HEX.HFIRE_D, (c) => { circle(c, 24, 24, 15, null, HEX.HFIRE, 3); circle(c, 24, 24, 7, null, HEX.HFIRE, 3); circle(c, 24, 24, 2.5, HEX.WHITE); });
  I('duration', HEX.WOOD, (c) => { poly(c, [[14, 8], [34, 8], [24, 24], [34, 40], [14, 40], [24, 24]], HEX.SKIN, OUT, 2.5); });
  I('armor', HEX.HULK_D, (c) => { poly(c, [[24, 6], [38, 12], [36, 28], [24, 42], [12, 28], [10, 12]], HEX.SLATE_H, OUT, 2.5); poly(c, [[24, 10], [34, 14], [33, 27], [24, 37]], HEX.SLATE_H); });
  I('growth', HEX.ROSE_D, (c) => { c.fillStyle = HEX.GLOOM; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.roundRect(11, 10, 26, 30, 3); c.fill(); c.stroke(); c.fillStyle = HEX.SLATE_H; c.fillRect(14, 12, 4, 26); glowDot(c, 28, 24, 7, rgba(HEX.BOG_L, 0.9)); });
  I('greed', HEX.WOOD, (c) => { blit(c, 'cinder', 18, 28, 1.4); blit(c, 'cinder', 30, 20, 1.4); });
  I('reservoir', HEX.ROSE_D, (c) => { c.fillStyle = HEX.SLATE; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.roundRect(14, 10, 20, 30, 6); c.fill(); c.stroke(); c.fillStyle = lin(c, 0, 22, 0, 38, [[0, HEX.ROSE_L], [1, HEX.R_PINK]]); c.beginPath(); c.roundRect(16, 22, 16, 16, 4); c.fill(); glowDot(c, 24, 28, 9, rgba(HEX.ROSE_L, 0.8)); c.fillStyle = HEX.SHROUD; c.fillRect(18, 6, 12, 5); });
  I('thorns', HEX.MOSS_D, (c) => { poly(c, [[24, 6], [38, 12], [36, 28], [24, 42], [12, 28], [10, 12]], HEX.MOSS, OUT, 2.5); for (const [x, y, a] of [[10, 12, -2.4], [38, 12, -0.7], [12, 28, 2.6], [36, 28, 0.5], [24, 42, 1.57], [24, 6, -1.57]]) poly(c, [[x + Math.cos(a) * 7, y + Math.sin(a) * 7], [x + Math.cos(a + 1.6) * 2.5, y + Math.sin(a + 1.6) * 2.5], [x + Math.cos(a - 1.6) * 2.5, y + Math.sin(a - 1.6) * 2.5]], HEX.BONE, OUT, 1.2); circle(c, 24, 24, 5, HEX.MOSS_L, OUT, 1.5); });
  I('pact', HEX.HEYE_D, (c) => { glowDot(c, 24, 24, 20, rgba(HEX.PACT, 0.8)); poly(c, star(24, 24, 16, 6, 5, -Math.PI / 2), HEX.INK, HEX.PACT, 2); });
  I('overcharge', HEX.WOOD, (c) => { glowDot(c, 24, 24, 20, rgba(HEX.R_GOLD, 0.9)); poly(c, [[26, 6], [14, 26], [23, 26], [20, 42], [34, 20], [25, 20]], HEX.EMBER_H, OUT, 2); });
  I('heal', HEX.HEYE_D, (c) => { blit(c, 'heart', 24, 25, 1.3); });
  I('cinderBag', HEX.WOOD, (c) => { blit(c, 'cinder', 24, 24, 2); });
  // seals + keepsake
  const seal = (c, col, dark, hi) => {
    glowDot(c, 24, 24, 23, col.replace('1)', '0.45)'));
    c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 17 : 20; c.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r); } c.closePath();
    c.fillStyle = radial(c, 19, 18, 26, [[0, hi], [0.55, col], [1, dark]]); c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
    circle(c, 24, 24, 14, null, rgba(HEX.INK, 0.35), 1.6); circle(c, 24, 24, 12.8, null, rgba(HEX.WHITE, 0.25), 1);
  };
  I('seal_dawn', HEX.R_GOLD_D, (c) => {
    seal(c, HEX.EMBER_L, HEX.R_GOLD_D, HEX.EMBER_H);
    c.fillStyle = HEX.EMBER_H; c.strokeStyle = HEX.R_GOLD_D; c.lineWidth = 1.4; c.beginPath(); c.arc(24, 30, 7, Math.PI, 0); c.fill(); c.stroke();
    c.strokeStyle = HEX.EMBER_H; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); for (let i = 0; i < 5; i++) { const a = Math.PI + 0.35 + i * 0.6; c.moveTo(24 + Math.cos(a) * 10, 30 + Math.sin(a) * 10); c.lineTo(24 + Math.cos(a) * 14, 30 + Math.sin(a) * 14); } c.moveTo(12, 31); c.lineTo(36, 31); c.stroke();
  });
  I('seal_swift', HEX.SLATE_D, (c) => {
    seal(c, HEX.SLATE_H, HEX.SLATE, HEX.FROST_H);
    c.beginPath(); c.moveTo(14, 33); c.quadraticCurveTo(14, 16, 33, 14); c.quadraticCurveTo(28, 22, 30, 24); c.quadraticCurveTo(24, 26, 26, 28); c.quadraticCurveTo(20, 30, 14, 33);
    c.fillStyle = HEX.WHITE; c.fill(); c.lineWidth = 1.6; c.strokeStyle = HEX.SLATE_D; c.stroke();
    c.strokeStyle = HEX.SLATE_H; c.lineWidth = 1; c.beginPath(); c.moveTo(16, 31); c.quadraticCurveTo(22, 22, 31, 16); c.stroke();
  });
  I('seal_ember', HEX.HFIRE_D, (c) => {
    seal(c, HEX.HFIRE, HEX.HFIRE_D, HEX.EMBER_L);
    c.beginPath(); c.moveTo(24, 35); c.bezierCurveTo(14, 34, 15, 25, 20, 21); c.bezierCurveTo(20, 17, 23, 14, 25, 12); c.bezierCurveTo(26, 17, 30, 19, 31, 24); c.bezierCurveTo(34, 31, 30, 35, 24, 35);
    c.fillStyle = HEX.EMBER_L; c.fill(); c.lineWidth = 1.6; c.strokeStyle = HEX.HFIRE_D; c.stroke();
    c.beginPath(); c.moveTo(24, 33); c.quadraticCurveTo(19, 31, 22, 26); c.quadraticCurveTo(26, 28, 26, 31); c.fillStyle = HEX.R_LIGHT; c.fill();
  });
  I('seal_iron', HEX.SLATE_D, (c) => {
    seal(c, HEX.SLATE_L, HEX.SLATE_D, HEX.SLATE_H);
    poly(c, [[24, 12], [34, 16], [33, 27], [24, 36], [15, 27], [14, 16]], HEX.SLATE, HEX.SLATE_H, 1.8);
    poly(c, [[24, 14], [32, 17.5], [31, 26], [24, 33]], HEX.SLATE);
    c.strokeStyle = HEX.SLATE_H; c.lineWidth = 1.6; c.beginPath(); c.moveTo(24, 14); c.lineTo(24, 33); c.moveTo(16.5, 21); c.lineTo(31.5, 21); c.stroke();
  });
  I('seal_fellow', HEX.MOSS_D, (c) => {
    seal(c, HEX.SPIRIT, HEX.SPIRIT_D, HEX.SPIRIT_L);
    for (const [x, y, col] of [[17, 29, HEX.EMBER_H], [31, 29, HEX.EMBER_H], [24, 21, HEX.R_LIGHT]]) {
      circle(c, x, y - 4, 3.2, col, HEX.MOSS_D, 1.3);
      c.beginPath(); c.moveTo(x - 4.4, y + 7); c.quadraticCurveTo(x, y - 3, x + 4.4, y + 7); c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 1.3; c.stroke();
    }
    c.strokeStyle = HEX.MOSS_D; c.lineWidth = 1.6; c.beginPath(); c.moveTo(21, 31); c.lineTo(27, 31); c.moveTo(20, 24); c.lineTo(22, 28); c.moveTo(28, 24); c.lineTo(26, 28); c.stroke();
  });
  I('keepsake', HEX.ROSE_D, (c) => {
    glowDot(c, 24, 28, 18, rgba(HEX.EMBER_L, 0.5));
    c.strokeStyle = HEX.EMBER_L; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 6); c.quadraticCurveTo(24, 20, 34, 6); c.stroke();
    c.strokeStyle = HEX.EMBER_L; c.lineWidth = 2.4; c.beginPath(); c.arc(24, 15, 3, 0, TAU); c.stroke();
    poly(c, [[24, 18], [35, 28], [24, 42], [13, 28]], lin(c, 13, 18, 35, 42, [[0, HEX.EMBER_H], [0.5, HEX.EMBER], [1, HEX.R_GOLD_D]]), OUT, 2.2);
    poly(c, [[24, 18], [35, 28], [24, 28]], rgba(HEX.WHITE, 0.45));
    circle(c, 24, 29, 3.6, HEX.HFIRE, OUT, 1.4); circle(c, 23, 28, 1.1, HEX.WHITE);
  });
}

// ---------- ground tile (separate texture for TilingSprite) ----------
export function makeGroundCanvas(pal) {
  seed = groundSeed;
  const S = 512;
  const g = document.createElement('canvas');
  g.width = S; g.height = S;
  const c = g.getContext('2d');
  c.fillStyle = pal.base;
  c.fillRect(0, 0, S, S);
  // tile-safe stamping: draw everything wrapped
  const stamp = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { c.save(); c.translate(ox, oy); fn(); c.restore(); } };
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, y = rnd() * S, r = 30 + rnd() * 90;
    const cols = pal.blobs;
    const col = cols[(rnd() * cols.length) | 0];
    stamp(() => { c.fillStyle = radial(c, x, y, r, [[0, col], [1, 'rgba(0,0,0,0)']]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
  }
  // flagstone path fragments
  for (let i = 0; i < 18; i++) {
    const x = rnd() * S, y = rnd() * S, w = 18 + rnd() * 26, h = 12 + rnd() * 16, a = rnd() * 0.6;
    stamp(() => {
      c.save(); c.translate(x, y); c.rotate(a);
      c.fillStyle = pal.stone; c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 4); c.fill(); c.stroke();
      c.restore();
    });
  }
  // cracks
  c.lineCap = 'round';
  for (let i = 0; i < 24; i++) {
    let x = rnd() * S, y = rnd() * S;
    const pts = [[x, y]];
    for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; pts.push([x, y]); }
    stamp(() => {
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.stroke();
    });
  }
  // speckle
  for (let i = 0; i < 1600; i++) {
    const x = rnd() * S, y = rnd() * S;
    c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
    c.fillRect(x, y, 2, 2);
  }
  return g;
}

// ---------- vignette (screen-space darkness: "the Gloam") ----------
export function makeVignetteCanvas() {
  const S = 512;
  const g = document.createElement('canvas');
  g.width = S; g.height = S;
  const c = g.getContext('2d');
  c.fillStyle = radial(c, S / 2, S / 2, S * 0.72, [[0, rgba(HEX.INK, 0)], [0.45, rgba(HEX.INK, 0)], [0.8, rgba(HEX.INK, 0.55)], [1, rgba(HEX.INK, 0.9)]]);
  c.fillRect(0, 0, S, S);
  return g;
}

// white edge glow (transparent centre): tinted + additive for hurt flashes and the Kindle glow
export function makeEdgeGlowCanvas() {
  const S = 512;
  const g = document.createElement('canvas');
  g.width = S; g.height = S;
  const c = g.getContext('2d');
  c.fillStyle = radial(c, S / 2, S / 2, S * 0.72, [[0, rgba(HEX.WHITE, 0)], [0.5, rgba(HEX.WHITE, 0)], [0.82, rgba(HEX.WHITE, 0.35)], [1, rgba(HEX.WHITE, 0.8)]]);
  c.fillRect(0, 0, S, S);
  return g;
}

export function buildAtlas() {
  drawFX();
  drawProjectiles();
  drawPickups();
  drawCharacters();
  drawNewBearers();
  drawObjectives();
  drawEnemies();
  drawDecor();
  drawDigits();
  drawIcons();
  groundSeed = seed;
  if (import.meta.env.DEV) window.__frames = frames;
  const source = new CanvasSource({ resource: atlasCanvas, resolution: SS, scaleMode: 'linear', autoGenerateMipmaps: false });
  for (const k in frames) {
    const f = frames[k];
    T[k] = new Texture({ source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
  }
  return T;
}

const iconCache = {};
export function iconURL(name) {
  if (iconCache[name]) return iconCache[name];
  const f = frames['icon_' + name] || frames[name];
  if (!f) return '';
  const cv = document.createElement('canvas');
  cv.width = f.w * SS; cv.height = f.h * SS;
  cv.getContext('2d').drawImage(atlasCanvas, f.x * SS, f.y * SS, f.w * SS, f.h * SS, 0, 0, f.w * SS, f.h * SS);
  return (iconCache[name] = cv.toDataURL());
}
export function spriteURL(name, scale = 1) {
  const key = name + '@' + scale;
  if (iconCache[key]) return iconCache[key];
  const f = frames[name];
  const cv = document.createElement('canvas');
  cv.width = f.w * scale; cv.height = f.h * scale;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.drawImage(atlasCanvas, f.x * SS, f.y * SS, f.w * SS, f.h * SS, 0, 0, f.w * scale, f.h * scale);
  return (iconCache[key] = cv.toDataURL());
}
