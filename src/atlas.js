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
  c.fillStyle = radial(c, x, y, r, [[0, '#fff'], [0.3, col], [1, 'rgba(0,0,0,0)']]);
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function shadow(c, x, y, rx, ry = rx * 0.35) {
  c.fillStyle = radial(c, 0, 0, 1, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
  c.save(); c.translate(x, y); c.scale(rx, ry);
  c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
}
function eye(c, x, y, r, col) {
  glowDot(c, x, y, r * 2.2, col);
  circle(c, x, y, r, '#fff');
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
const OUT = '#0b0614';

// ---------- FX ----------
function drawFX() {
  make('glow', 64, 64, (c) => {
    c.fillStyle = radial(c, 32, 32, 32, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 64, 64);
  });
  make('softglow', 128, 128, (c) => {
    c.fillStyle = radial(c, 64, 64, 64, [[0, 'rgba(255,255,255,0.7)'], [0.5, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 128, 128);
  });
  make('dot', 12, 12, (c) => {
    c.fillStyle = radial(c, 6, 6, 6, [[0, '#fff'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 12, 12);
  });
  make('spark', 24, 24, (c) => {
    c.fillStyle = radial(c, 12, 12, 12, [[0, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 24, 24);
    poly(c, star(12, 12, 12, 2, 4, 0), '#fff');
  });
  make('shard', 12, 12, (c) => poly(c, [[6, 0], [12, 6], [6, 12], [0, 6]], '#fff'));
  make('streak', 32, 6, (c) => {
    c.fillStyle = lin(c, 0, 0, 32, 0, [[0, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,0.8)'], [1, '#fff']]);
    c.beginPath(); c.ellipse(16, 3, 16, 3, 0, 0, TAU); c.fill();
  });
  make('smoke', 40, 40, (c) => {
    for (let i = 0; i < 6; i++) {
      const x = 20 + (rnd() - 0.5) * 14, y = 20 + (rnd() - 0.5) * 14;
      c.fillStyle = radial(c, x, y, 13, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
      c.beginPath(); c.arc(x, y, 13, 0, TAU); c.fill();
    }
  });
  make('ring', 128, 128, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 10;
    c.beginPath(); c.arc(64, 64, 57, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3;
    c.beginPath(); c.arc(64, 64, 58, 0, TAU); c.stroke();
  });
  make('aura', 160, 160, (c) => {
    c.fillStyle = radial(c, 80, 80, 80, [[0, 'rgba(255,255,255,0)'], [0.65, 'rgba(255,255,255,0.05)'], [0.92, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 160, 160);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.setLineDash([10, 8]);
    c.beginPath(); c.arc(80, 80, 72, 0, TAU); c.stroke();
  });
  make('beam', 64, 28, (c) => {
    c.fillStyle = lin(c, 0, 0, 0, 28, [[0, 'rgba(255,255,255,0)'], [0.3, 'rgba(255,255,255,0.4)'], [0.5, '#fff'], [0.7, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 64, 28);
  });
  make('bolt_seg', 32, 10, (c) => {
    c.fillStyle = lin(c, 0, 0, 0, 10, [[0, 'rgba(255,255,255,0)'], [0.5, '#fff'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 32, 10);
  });
  make('slash', 128, 128, (c) => {
    // crescent arc pointing right
    c.save(); c.translate(64, 64);
    const g = c.createLinearGradient(0, -60, 0, 60);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 60, -1.3, 1.3); c.arc(-18, 0, 50, 1.2, -1.2, true); c.closePath(); c.fill();
    c.restore();
  });
  make('target', 64, 64, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3; c.setLineDash([8, 6]);
    c.beginPath(); c.arc(32, 32, 28, 0, TAU); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.arc(32, 32, 28, 0, TAU); c.fill();
  });
  make('shadow', 48, 18, (c) => shadow(c, 24, 9, 23, 8));
  make('pixel', 4, 4, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); });
}

// ---------- projectiles ----------
function drawProjectiles() {
  make('bolt', 32, 32, (c) => {
    glowDot(c, 16, 16, 16, 'rgba(255,140,40,0.9)');
    circle(c, 16, 16, 7, '#ffd27a');
    circle(c, 16, 16, 4, '#fff');
  });
  make('blade', 40, 40, (c) => {
    c.save(); c.translate(20, 20);
    glowDot(c, 0, 0, 20, 'rgba(120,220,255,0.35)');
    c.beginPath(); c.arc(0, 0, 15, -2.2, 0.8); c.arc(5, -3, 10, 0.6, -2.0, true); c.closePath();
    c.fillStyle = lin(c, -15, -15, 15, 15, [[0, '#e8fbff'], [1, '#6cc8f0']]); c.fill();
    c.lineWidth = 1.5; c.strokeStyle = '#0d2a3a'; c.stroke();
    c.restore();
  });
  make('wisp', 28, 28, (c) => {
    glowDot(c, 14, 14, 14, 'rgba(140,255,230,0.8)');
    circle(c, 14, 14, 5, '#e6fff9');
  });
  make('glaive', 48, 48, (c) => {
    c.save(); c.translate(24, 24);
    glowDot(c, 0, 0, 24, 'rgba(210,200,255,0.4)');
    for (let i = 0; i < 3; i++) {
      c.rotate(TAU / 3);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(14, -6, 20, -18); c.quadraticCurveTo(10, -4, 0, 0);
      c.fillStyle = '#e9e4ff'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#3a2f6a'; c.stroke();
    }
    circle(c, 0, 0, 6, '#b9a8ff', '#3a2f6a', 1.5);
    c.restore();
  });
  make('meteor', 48, 48, (c) => {
    glowDot(c, 24, 24, 24, 'rgba(255,110,30,0.8)');
    poly(c, [[14, 18], [24, 10], [35, 15], [38, 27], [30, 37], [17, 35], [11, 27]], '#5a3424', '#ffb15a', 2);
    circle(c, 26, 22, 4, '#ffcf8a'); circle(c, 19, 29, 3, '#ff8a3a');
  });
  make('mine', 32, 32, (c) => {
    c.save(); c.translate(16, 16);
    for (let i = 0; i < 6; i++) {
      c.rotate(TAU / 6);
      ellipse(c, 0, -8, 4.5, 8, '#ff7ab8', '#4a0f2c', 1.5);
    }
    circle(c, 0, 0, 6, '#ffe36e', '#4a0f2c', 1.5);
    c.restore();
  });
  make('drone', 36, 36, (c) => {
    c.save(); c.translate(18, 18);
    glowDot(c, 0, 4, 14, 'rgba(120,200,255,0.4)');
    ellipse(c, -11, -6, 6, 2.5, '#9fb8c8', OUT, 1.2); ellipse(c, 11, -6, 6, 2.5, '#9fb8c8', OUT, 1.2);
    poly(c, [[-9, -2], [9, -2], [11, 6], [0, 11], [-11, 6]], '#c9a45a', OUT, 2);
    circle(c, 0, 3, 4, '#7ef0ff');
    circle(c, 0, 3, 2, '#fff');
    c.restore();
  });
  make('orb', 20, 20, (c) => {
    glowDot(c, 10, 10, 10, 'rgba(200,60,255,0.9)');
    circle(c, 10, 10, 4, '#ffd0ff');
  });
  make('icicle', 28, 12, (c) => {
    poly(c, [[0, 6], [8, 1], [28, 6], [8, 11]], '#d9f6ff', '#3b7ca8', 1.5);
  });
  make('feather', 30, 14, (c) => {
    glowDot(c, 15, 7, 12, 'rgba(255,240,180,0.5)');
    ellipse(c, 15, 7, 13, 4, '#fff4d6', '#9a7a3a', 1.2);
  });
}

// ---------- pickups ----------
function gem(name, light, mid, dark, s = 1) {
  const w = Math.round(22 * s), h = Math.round(28 * s);
  make(name, w, h, (c) => {
    c.save(); c.scale(s, s);
    glowDot(c, 11, 14, 13, mid.replace(')', ',0.35)').replace('rgb', 'rgba'));
    poly(c, [[11, 2], [19, 12], [11, 26], [3, 12]], mid, dark, 1.6);
    poly(c, [[11, 2], [19, 12], [11, 14]], light);
    poly(c, [[3, 12], [11, 14], [11, 26]], dark);
    circle(c, 9, 9, 1.6, '#fff');
    c.restore();
  });
}
function drawPickups() {
  gem('gem0', '#bfe9ff', 'rgb(70,170,255)', '#13335e');
  gem('gem1', '#c9ffcf', 'rgb(60,220,110)', '#0f4a26');
  gem('gem2', '#ffd0d0', 'rgb(255,70,90)', '#5a0f1c');
  gem('gem3', '#f1d4ff', 'rgb(190,90,255)', '#3a0f5a');
  gem('gem4', '#fff3c4', 'rgb(255,200,60)', '#5a3a0a', 1.4);
  make('heart', 28, 26, (c) => {
    glowDot(c, 14, 13, 14, 'rgba(255,80,110,0.45)');
    c.beginPath(); c.moveTo(14, 23); c.bezierCurveTo(-2, 12, 4, 0, 14, 7); c.bezierCurveTo(24, 0, 30, 12, 14, 23);
    c.fillStyle = '#ff4f6d'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#4a0614'; c.stroke();
    ellipse(c, 9, 9, 3, 2, '#ffc2cc');
  });
  make('magnet', 28, 28, (c) => {
    glowDot(c, 14, 14, 14, 'rgba(120,180,255,0.45)');
    c.lineCap = 'butt'; c.lineWidth = 7; c.strokeStyle = OUT;
    c.beginPath(); c.arc(14, 13, 8, Math.PI, 0); c.lineTo(22, 22); c.moveTo(6, 13); c.lineTo(6, 22); c.stroke();
    c.lineWidth = 4.5; c.strokeStyle = '#e04050';
    c.beginPath(); c.arc(14, 13, 8, Math.PI, 0); c.stroke();
    c.strokeStyle = '#dfe8ff'; c.beginPath(); c.moveTo(6, 13); c.lineTo(6, 22); c.moveTo(22, 13); c.lineTo(22, 22); c.stroke();
  });
  make('bomb', 30, 30, (c) => {
    glowDot(c, 15, 15, 15, 'rgba(255,220,90,0.5)');
    poly(c, star(15, 16, 13, 6, 8, -Math.PI / 2), '#ffcf3a', '#5a3200', 2);
    circle(c, 15, 16, 5, '#fff7d0');
  });
  make('freeze', 30, 30, (c) => {
    glowDot(c, 15, 15, 15, 'rgba(140,220,255,0.5)');
    c.save(); c.translate(15, 15); c.strokeStyle = '#0c2c44'; c.lineWidth = 5; c.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 3; i++) {
        c.save(); c.rotate((i * Math.PI) / 3);
        c.beginPath(); c.moveTo(0, -11); c.lineTo(0, 11); c.moveTo(-4, -8); c.lineTo(0, -5); c.lineTo(4, -8); c.moveTo(-4, 8); c.lineTo(0, 5); c.lineTo(4, 8); c.stroke();
        c.restore();
      }
      c.strokeStyle = '#d6f4ff'; c.lineWidth = 2.2;
    }
    c.restore();
  });
  make('cinder', 18, 18, (c) => {
    glowDot(c, 9, 9, 9, 'rgba(255,150,40,0.6)');
    circle(c, 9, 9, 6, '#ffb03a', '#5a2a00', 1.5);
    poly(c, [[9, 4], [11.5, 9], [9, 14], [6.5, 9]], '#fff1c2');
  });
  make('flareorb', 28, 28, (c) => {
    glowDot(c, 14, 14, 14, 'rgba(255,90,200,0.7)');
    poly(c, star(14, 14, 10, 4, 4, Math.PI / 4), '#ffd6f4', '#5a0a40', 1.5);
  });
  make('chest', 44, 38, (c) => {
    shadow(c, 22, 33, 20, 5);
    glowDot(c, 22, 18, 22, 'rgba(255,200,80,0.35)');
    c.fillStyle = '#6a3a1a'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(5, 15, 34, 18, 3); c.fill(); c.stroke();
    c.fillStyle = '#8a4e22'; c.beginPath(); c.roundRect(4, 6, 36, 12, [8, 8, 2, 2]); c.fill(); c.stroke();
    c.fillStyle = '#ffcf4a'; c.fillRect(19, 6, 6, 27); c.fillRect(4, 15, 36, 3);
    c.strokeRect(19, 6, 6, 27);
    circle(c, 22, 19, 3.5, '#fff1b0', OUT, 1.5);
  });
}

// ---------- characters ----------
// STEP (-1, 0, 1) poses the legs for the walk cycle frames
let STEP = 0;
function legs(c, cx, by, col) {
  c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 2;
  const l = STEP * 3;
  c.beginPath(); c.roundRect(cx - 9 + STEP, by - 10 - Math.max(0, l), 7, 11, 2); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(cx + 2 + STEP, by - 10 - Math.max(0, -l), 7, 11, 2); c.fill(); c.stroke();
}
// Each Bearer gets an idle frame plus two stepping frames (_s1, _s2)
function makeChar(name, draw) {
  for (const [suffix, st] of [['', 0], ['_s1', 1], ['_s2', -1]]) {
    STEP = st;
    make(name + suffix, 64, 64, (c) => { c.translate(0, st ? -1 : 0); draw(c); });
  }
  STEP = 0;
}
function drawCharacters() {
  // Kael — Ashen Warden: hooded, ash-grey cloak, carries a lantern with the Ember
  makeChar('warden', (c) => {
    shadow(c, 32, 58, 18, 5);
    legs(c, 32, 58, '#3a3346');
    poly(c, [[18, 52], [22, 26], [32, 18], [42, 26], [46, 52]], '#6b6478', OUT, 2.5);
    poly(c, [[22, 52], [26, 30], [32, 26], [38, 30], [42, 52]], '#8a8296');
    poly(c, [[20, 28], [32, 8], [44, 28], [38, 32], [26, 32]], '#585068', OUT, 2.5); // hood
    ellipse(c, 32, 26, 7.5, 6, '#140d1e');
    eye(c, 29, 26, 1.6, '#ffb040'); eye(c, 35, 26, 1.6, '#ffb040');
    c.strokeStyle = '#2a2232'; c.lineWidth = 2; c.beginPath(); c.moveTo(47, 32); c.lineTo(50, 40); c.stroke();
    glowDot(c, 50, 46, 14, 'rgba(255,150,40,0.85)');
    c.fillStyle = '#d0a040'; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.roundRect(46, 40, 8, 11, 2); c.fill(); c.stroke();
    circle(c, 50, 45.5, 2.6, '#fff4c0');
  });
  // Ysolde — Rime Oracle: tall crystal headdress, icy robes, frost staff
  makeChar('oracle', (c) => {
    shadow(c, 32, 58, 18, 5);
    poly(c, [[17 + STEP * 3, 56], [24, 26], [40, 26], [47 + STEP * 3, 56]], '#2d5d8c', OUT, 2.5);
    poly(c, [[24 + STEP * 2, 56], [28, 30], [36, 30], [40 + STEP * 2, 56]], '#bfe8ff');
    circle(c, 32, 21, 8.5, '#e9d7c8', OUT, 2.5);
    poly(c, [[22, 18], [26, 4], [29, 12], [32, 0], [35, 12], [38, 4], [42, 18], [32, 15]], '#9fe6ff', OUT, 2);
    ellipse(c, 29, 22, 1.4, 2, '#1a3d66'); ellipse(c, 35, 22, 1.4, 2, '#1a3d66');
    c.strokeStyle = '#d8e6f0'; c.lineWidth = 3; c.beginPath(); c.moveTo(13, 56); c.lineTo(15, 20); c.stroke();
    glowDot(c, 15, 17, 12, 'rgba(120,220,255,0.9)');
    poly(c, [[15, 9], [19, 17], [15, 25], [11, 17]], '#e8fbff', '#2a6a9a', 1.5);
  });
  // Pip — Clockwork Tinker: small, big goggles, brass backpack with antenna
  makeChar('tinker', (c) => {
    shadow(c, 32, 58, 17, 5);
    legs(c, 32, 58, '#4a3524');
    c.fillStyle = '#b8862e'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(37, 28, 14, 18, 3); c.fill(); c.stroke();
    c.strokeStyle = '#555'; c.lineWidth = 2; c.beginPath(); c.moveTo(46, 28); c.lineTo(48, 14); c.stroke();
    glowDot(c, 48, 13, 6, 'rgba(120,255,200,0.9)');
    poly(c, [[20, 52], [21, 32], [43, 32], [44, 52]], '#4f7a5a', OUT, 2.5);
    c.fillStyle = '#d9b48a'; c.beginPath(); c.roundRect(20, 14, 24, 20, 8); c.fill(); c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#7a4a22'; c.beginPath(); c.roundRect(19, 11, 26, 7, 4); c.fill(); c.stroke();
    circle(c, 27, 22, 5.5, '#2a2a2a', OUT, 2); circle(c, 37, 22, 5.5, '#2a2a2a', OUT, 2);
    circle(c, 27, 22, 3.6, '#7ef0ff'); circle(c, 37, 22, 3.6, '#7ef0ff');
    circle(c, 26, 21, 1.2, '#fff'); circle(c, 36, 21, 1.2, '#fff');
    c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.arc(32, 28, 3, 0.2, Math.PI - 0.2); c.stroke();
  });
  // Grahm — Blood Reaver: crimson armor, horned helm, huge crescent axe
  makeChar('reaver', (c) => {
    shadow(c, 32, 58, 19, 5);
    legs(c, 32, 58, '#3a1616');
    c.strokeStyle = '#4a3020'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(48, 54); c.lineTo(52, 12); c.stroke();
    c.beginPath(); c.moveTo(52, 12); c.quadraticCurveTo(64, 20, 56, 34); c.quadraticCurveTo(58, 22, 51, 20); c.closePath();
    c.fillStyle = '#d8d8e0'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    poly(c, [[16, 50], [18, 28], [46, 28], [48, 50]], '#8e1c24', OUT, 2.5);
    poly(c, [[24, 50], [26, 32], [38, 32], [40, 50]], '#b8323a');
    circle(c, 18, 30, 6, '#5a5a66', OUT, 2); circle(c, 46, 30, 6, '#5a5a66', OUT, 2);
    c.fillStyle = '#5a5a66'; c.beginPath(); c.roundRect(22, 10, 20, 20, 7); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
    poly(c, [[22, 16], [12, 4], [16, 16]], '#e8dcc0', OUT, 2); poly(c, [[42, 16], [52, 4], [48, 16]], '#e8dcc0', OUT, 2);
    c.fillStyle = '#140808'; c.fillRect(25, 18, 14, 4);
    eye(c, 29, 20, 1.4, '#ff3030'); eye(c, 35, 20, 1.4, '#ff3030');
  });
  // Lune — Moon Dancer: lithe, flowing violet scarf, moon circlet
  makeChar('dancer', (c) => {
    shadow(c, 32, 58, 16, 5);
    legs(c, 32, 58, '#2b2244');
    c.fillStyle = '#c070ff'; c.beginPath(); c.moveTo(24, 30); c.quadraticCurveTo(6, 34, 4, 48); c.quadraticCurveTo(14, 38, 26, 36); c.fill();
    poly(c, [[22, 50], [25, 28], [39, 28], [42, 50]], '#3d2f6e', OUT, 2.5);
    poly(c, [[27, 50], [29, 31], [35, 31], [37, 50]], '#e6e0ff');
    circle(c, 32, 20, 8.5, '#f0d9c8', OUT, 2.5);
    c.fillStyle = '#e6e0ff'; c.beginPath(); c.arc(32, 15, 9.5, Math.PI, 0); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    glowDot(c, 32, 9, 7, 'rgba(220,210,255,0.9)');
    c.fillStyle = '#fff'; c.beginPath(); c.arc(32, 9, 4, 0, TAU); c.fill();
    c.fillStyle = '#e6e0ff'; c.beginPath(); c.arc(33.5, 8, 3.4, 0, TAU); c.fill();
    ellipse(c, 29, 21, 1.3, 1.8, '#4a2a7a'); ellipse(c, 35, 21, 1.3, 1.8, '#4a2a7a');
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
    c.fillStyle = lin(c, 0, -26, 0, 0, [[0, '#5b3a8a'], [1, '#24143d']]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    ellipse(c, -4, -19, 4, 2.5, 'rgba(255,255,255,0.18)');
    c.restore();
    eye(c, 15, 22 + f, 2.3, '#5ff8ff'); eye(c, 25, 22 + f, 2.3, '#5ff8ff');
  });
  // Dusk Moth — fast, fluttering
  for (const f of [0, 1]) make('moth' + f, 40, 40, (c) => {
    shadow(c, 20, 36, 10, 3);
    c.save(); c.translate(20, 19);
    const wy = f ? 0.55 : 1;
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, wy);
      c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(18, -20, 19, -4); c.quadraticCurveTo(16, 6, 0, 3);
      c.fillStyle = '#7a3a5e'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      circle(c, 11, -6, 3, '#ff9ad0');
      c.beginPath(); c.moveTo(0, 3); c.quadraticCurveTo(13, 6, 12, 15); c.quadraticCurveTo(5, 12, 0, 5);
      c.fillStyle = '#5a2846'; c.fill(); c.stroke();
      c.restore();
    }
    ellipse(c, 0, 0, 4, 9, '#2a1424', OUT, 2);
    eye(c, -2, -5, 1.4, '#ffd060'); eye(c, 2, -5, 1.4, '#ffd060');
    c.restore();
  });
  // Husk — lumbering stone hulk with ember cracks
  for (const f of [0, 1]) make('husk' + f, 60, 60, (c) => {
    shadow(c, 30, 54, 22, 6);
    const lift = f ? -2 : 0;
    c.fillStyle = '#4a4040'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(15, 44 + lift, 10, 11, 3); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(35, 44 - lift, 10, 11, 3); c.fill(); c.stroke();
    poly(c, [[10, 44], [8, 22], [18, 10], [42, 10], [52, 22], [50, 44]], '#6a5a52', OUT, 3);
    poly(c, [[14, 40], [13, 24], [20, 15], [40, 15], [46, 24], [46, 40]], '#7d6b60');
    c.strokeStyle = '#ff6a20'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(20, 30); c.lineTo(26, 36); c.lineTo(24, 42); c.moveTo(38, 22); c.lineTo(34, 30); c.lineTo(40, 36); c.stroke();
    c.fillStyle = '#6a5a52'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(3, 22 - lift, 10, 20, 4); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(47, 22 + lift, 10, 20, 4); c.fill(); c.stroke();
    c.fillStyle = '#140c0c'; c.fillRect(21, 19, 18, 6);
    eye(c, 26, 22, 2, '#ff5a20'); eye(c, 34, 22, 2, '#ff5a20');
  });
  // Wraith — hooded spirit trailing a ragged tail
  for (const f of [0, 1]) make('wraith' + f, 48, 52, (c) => {
    c.save(); c.translate(24, 0);
    const w = f ? 3 : -3;
    c.beginPath(); c.moveTo(-14, 20); c.quadraticCurveTo(-16, 4, 0, 3); c.quadraticCurveTo(16, 4, 14, 20);
    c.lineTo(12, 38); c.lineTo(6 + w, 34); c.lineTo(2, 48); c.lineTo(-3 + w, 36); c.lineTo(-9, 44); c.lineTo(-12, 34);
    c.closePath();
    c.fillStyle = lin(c, 0, 3, 0, 48, [[0, 'rgba(90,200,190,0.95)'], [1, 'rgba(30,80,90,0.25)']]); c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(10,30,40,0.9)'; c.stroke();
    ellipse(c, 0, 16, 9, 8, '#071a1e');
    eye(c, -4, 16, 1.8, '#d0fff4'); eye(c, 4, 16, 1.8, '#d0fff4');
    c.restore();
  });
  // Bloater (splitter) — pustule sac that bursts into broodlings
  make('splitter0', 48, 48, (c) => {
    shadow(c, 24, 43, 16, 4);
    circle(c, 24, 25, 17, lin(c, 0, 8, 0, 42, [[0, '#9ad04a'], [1, '#3a6a1a']]), OUT, 2.5);
    circle(c, 15, 18, 5, '#c6f07a', OUT, 1.5); circle(c, 32, 31, 4, '#c6f07a', OUT, 1.5); circle(c, 30, 15, 3, '#c6f07a', OUT, 1.5);
    eye(c, 20, 26, 2.4, '#ff3a6a'); eye(c, 28, 24, 1.8, '#ff3a6a');
  });
  make('splitter1', 48, 48, (c) => {
    shadow(c, 24, 43, 17, 4);
    ellipse(c, 24, 26, 18, 16, lin(c, 0, 8, 0, 42, [[0, '#9ad04a'], [1, '#3a6a1a']]), OUT, 2.5);
    circle(c, 15, 19, 5.5, '#c6f07a', OUT, 1.5); circle(c, 32, 32, 4.5, '#c6f07a', OUT, 1.5); circle(c, 30, 16, 3.2, '#c6f07a', OUT, 1.5);
    eye(c, 20, 27, 2.4, '#ff3a6a'); eye(c, 28, 25, 1.8, '#ff3a6a');
  });
  for (const f of [0, 1]) make('broodling' + f, 24, 24, (c) => {
    shadow(c, 12, 21, 8, 2.5);
    c.strokeStyle = OUT; c.lineWidth = 1.5;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(12, 14); c.lineTo(12 + s * 10, 12 + (f ? 6 : 2)); c.stroke(); }
    circle(c, 12, 13, 7, '#7ab83a', OUT, 2);
    eye(c, 10, 12, 1.4, '#ff3a6a'); eye(c, 14, 12, 1.4, '#ff3a6a');
  });
  // Ram Beetle (charger)
  for (const f of [0, 1]) make('beetle' + f, 52, 48, (c) => {
    shadow(c, 26, 43, 19, 5);
    c.strokeStyle = OUT; c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(26 + s * 8, 26 + i * 6); c.lineTo(26 + s * 19, 30 + i * 6 + ((i + f) % 2 ? 3 : -2)); c.stroke();
    }
    ellipse(c, 26, 28, 15, 14, lin(c, 0, 14, 0, 42, [[0, '#a8384a'], [1, '#4a1020']]), OUT, 2.5);
    c.beginPath(); c.moveTo(26, 14); c.lineTo(26, 42); c.stroke();
    poly(c, [[20, 16], [26, 0], [32, 16]], '#e8d8b0', OUT, 2);
    ellipse(c, 21, 22, 3, 5, 'rgba(255,255,255,0.25)');
    eye(c, 21, 15, 1.6, '#ffe040'); eye(c, 31, 15, 1.6, '#ffe040');
  });
  // Spitter — bloated toad that lobs venom orbs
  for (const f of [0, 1]) make('spitter' + f, 46, 44, (c) => {
    shadow(c, 23, 39, 17, 4);
    ellipse(c, 23, 27, 17, 13 - f, lin(c, 0, 14, 0, 40, [[0, '#4ab8a0'], [1, '#14524a']]), OUT, 2.5);
    ellipse(c, 23, 31, 10, 6, '#bff0d0');
    ellipse(c, 23, 30 + f, 6, 2 + f * 3, '#3a0a2a');
    circle(c, 14, 16, 5.5, '#4ab8a0', OUT, 2); circle(c, 32, 16, 5.5, '#4ab8a0', OUT, 2);
    eye(c, 14, 16, 2.4, '#ff8a20'); eye(c, 32, 16, 2.4, '#ff8a20');
  });
  // Sentinel — floating spiked eye (late-game elite fodder)
  for (const f of [0, 1]) make('sentinel' + f, 64, 64, (c) => {
    shadow(c, 32, 60, 14, 4);
    c.save(); c.translate(32, 28); c.rotate(f ? 0.2 : 0);
    poly(c, star(0, 0, 27, 15, 8), '#3a2a5a', OUT, 2.5);
    c.restore();
    circle(c, 32, 28, 16, radial(c, 32, 28, 16, [[0, '#fff'], [0.4, '#f0e0ff'], [1, '#9070c0']]), OUT, 2.5);
    circle(c, 32, 28, 8, '#ff2a5a'); circle(c, 32, 28, 4, '#140008'); circle(c, 29, 25, 2, '#fff');
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
    c.strokeStyle = '#4a2a5a'; c.lineWidth = 3;
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const a = 0.3 + i * 0.4 + (f && i % 2 ? 0.12 : 0);
      c.beginPath(); c.moveTo(75 + s * 25, 80);
      c.quadraticCurveTo(75 + s * (50 + i * 6), 40 + i * 14, 75 + s * (60 + Math.cos(a) * 12), 110 + i * 5);
      c.stroke();
    }
    ellipse(c, 75, 92, 40, 30, lin(c, 0, 62, 0, 122, [[0, '#8a3aa0'], [1, '#2a0a3a']]), OUT, 4);
    for (let i = 0; i < 6; i++) circle(c, 55 + i * 8, 100 + (i % 2) * 8, 4, '#d070ff', OUT, 1.5);
    circle(c, 75, 52, 26, lin(c, 0, 26, 0, 78, [[0, '#a050c0'], [1, '#4a1a6a']]), OUT, 4);
    const eyes = [[63, 46, 4], [87, 46, 4], [75, 40, 3], [68, 58, 3], [82, 58, 3], [75, 52, 5]];
    for (const [x, y, r] of eyes) eye(c, x, y, r, '#ffe050');
  });
  // Cinder Colossus
  for (const f of [0, 1]) make('colossus' + f, 190, 190, (c) => {
    shadow(c, 95, 176, 70, 14);
    const l = f ? 5 : 0;
    c.fillStyle = '#3a3036'; c.strokeStyle = OUT; c.lineWidth = 5;
    c.beginPath(); c.roundRect(58, 140 - l, 28, 38, 8); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(104, 140 + l - 5, 28, 38, 8); c.fill(); c.stroke();
    poly(c, [[40, 140], [30, 70], [60, 36], [130, 36], [160, 70], [150, 140]], '#4e4248', OUT, 5);
    poly(c, [[52, 132], [46, 76], [68, 48], [122, 48], [144, 76], [138, 132]], '#5e5056');
    glowDot(c, 95, 96, 34, 'rgba(255,120,30,0.95)');
    poly(c, star(95, 96, 18, 9, 6, f * 0.3), '#ffe0a0');
    c.strokeStyle = '#ff7a20'; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(60, 70); c.lineTo(76, 88); c.moveTo(130, 72); c.lineTo(114, 88); c.moveTo(80, 130); c.lineTo(95, 116); c.lineTo(110, 132); c.stroke();
    c.fillStyle = '#4e4248'; c.strokeStyle = OUT; c.lineWidth = 5;
    c.beginPath(); c.roundRect(8, 66 + l, 30, 70, 12); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(152, 66 - l, 30, 70, 12); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(70, 8, 50, 40, 12); c.fill(); c.stroke();
    c.fillStyle = '#100808'; c.fillRect(78, 22, 34, 10);
    eye(c, 86, 27, 4, '#ff6a20'); eye(c, 104, 27, 4, '#ff6a20');
  });
  // Eclipse Tyrant — a black sun wearing a crown of corona
  for (const f of [0, 1]) make('tyrant' + f, 220, 220, (c) => {
    c.save(); c.translate(110, 105);
    c.fillStyle = radial(c, 0, 0, 108, [[0, 'rgba(255,240,200,0)'], [0.55, 'rgba(255,170,60,0.0)'], [0.62, 'rgba(255,190,90,0.9)'], [0.8, 'rgba(255,90,30,0.35)'], [1, 'rgba(120,0,60,0)']]);
    c.beginPath(); c.arc(0, 0, 108, 0, TAU); c.fill();
    c.rotate(f * 0.15);
    poly(c, star(0, 0, 100, 64, 14), 'rgba(255,140,40,0.55)');
    c.rotate(-f * 0.3);
    poly(c, star(0, 0, 86, 62, 10, 0.3), 'rgba(255,220,120,0.6)');
    c.rotate(f * 0.15);
    circle(c, 0, 0, 62, radial(c, -12, -12, 70, [[0, '#2a1438'], [1, '#05010a']]), '#ffb060', 4);
    // crown
    poly(c, [[-36, -50], [-30, -84], [-14, -62], [0, -96], [14, -62], [30, -84], [36, -50]], '#1a0a24', '#ffcf6a', 3);
    for (const x of [-30, 0, 30]) circle(c, x, x ? -84 : -96, 4, '#ff3a6a');
    eye(c, -22, -6, 7, '#ff3a6a'); eye(c, 22, -6, 7, '#ff3a6a');
    c.strokeStyle = '#ff3a6a'; c.lineWidth = 3; c.beginPath(); c.arc(0, 18, 20, 0.2, Math.PI - 0.2); c.stroke();
    c.restore();
  });
  // Cinder Imp — squat ember-bodied imp with a flame tuft (Ashfields)
  for (const f of [0, 1]) make('imp' + f, 40, 42, (c) => {
    shadow(c, 20, 38, 11, 3.5);
    const hop = f ? -2 : 0;
    c.save(); c.translate(0, hop);
    // flame tuft
    c.fillStyle = radial(c, 20, 10, 12, [[0, '#fff2a0'], [0.4, '#ffb030'], [1, 'rgba(255,80,0,0)']]);
    c.beginPath(); c.moveTo(14, 16); c.quadraticCurveTo(13 + f * 2, 4, 20, 1); c.quadraticCurveTo(26 - f * 2, 6, 26, 16); c.fill();
    // horns
    poly(c, [[12, 15], [8, 6], [15, 12]], '#2a1410', OUT, 1.5);
    poly(c, [[28, 15], [32, 6], [25, 12]], '#2a1410', OUT, 1.5);
    // body
    c.beginPath(); c.ellipse(20, 25, 11, 11, 0, 0, TAU);
    c.fillStyle = radial(c, 17, 21, 14, [[0, '#ff9a40'], [0.6, '#c43a10'], [1, '#5a1406']]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    // ember cracks
    c.strokeStyle = '#ffd060'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(14, 30); c.lineTo(17, 27); c.lineTo(15, 24); c.moveTo(26, 29); c.lineTo(23, 27); c.stroke();
    // stubby arms
    ellipse(c, 8, 27 + (f ? -2 : 1), 3, 4, '#a8300c', OUT, 1.5);
    ellipse(c, 32, 27 + (f ? 1 : -2), 3, 4, '#a8300c', OUT, 1.5);
    eye(c, 16, 23, 1.8, '#fff060'); eye(c, 24, 23, 1.8, '#fff060');
    c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.arc(20, 28, 3.5, 0.3, Math.PI - 0.3); c.stroke();
    c.restore();
  });
  // Frost Wisp — drifting pale flame of ice with orbiting crystal shards (Rimewood)
  for (const f of [0, 1]) make('frostwisp' + f, 44, 48, (c) => {
    shadow(c, 22, 44, 9, 3);
    glowDot(c, 22, 22, 20, 'rgba(140,220,255,0.45)');
    c.save(); c.translate(22, 24);
    c.beginPath(); c.moveTo(0, -20 + f * 2);
    c.bezierCurveTo(10, -10, 12, 4, 6, 11); c.quadraticCurveTo(0, 15, -6, 11);
    c.bezierCurveTo(-12, 4, -10, -10, 0, -20 + f * 2);
    c.fillStyle = lin(c, 0, -20, 0, 14, [[0, 'rgba(235,250,255,0.95)'], [0.5, 'rgba(150,215,255,0.9)'], [1, 'rgba(60,120,190,0.85)']]); c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(15,40,70,0.9)'; c.stroke();
    ellipse(c, 0, 2, 6, 7, 'rgba(10,30,60,0.85)');
    eye(c, -2.5, 1, 1.5, '#e0f8ff'); eye(c, 2.5, 1, 1.5, '#e0f8ff');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + f * 0.5;
      const x = Math.cos(a) * 15, y = Math.sin(a) * 9 + 4;
      poly(c, [[x, y - 4], [x + 2.5, y], [x, y + 4], [x - 2.5, y]], '#e8faff', '#3a7aa8', 1);
    }
    c.restore();
  });
  // Gloom Totem — breakable crystal obelisk that holds loot
  make('totem', 40, 60, (c) => {
    shadow(c, 20, 54, 15, 4);
    glowDot(c, 20, 28, 20, 'rgba(255,190,90,0.45)');
    poly(c, [[20, 2], [32, 20], [27, 52], [13, 52], [8, 20]], '#3a2a5a', OUT, 2.5);
    poly(c, [[20, 8], [27, 21], [20, 44], [13, 21]], '#ffcf6a');
    poly(c, [[20, 8], [27, 21], [20, 26]], '#fff2c4');
  });
  // White flash variants
  for (const n of ['gloomling0', 'gloomling1', 'moth0', 'moth1', 'husk0', 'husk1', 'wraith0', 'wraith1',
    'splitter0', 'splitter1', 'broodling0', 'broodling1', 'beetle0', 'beetle1', 'spitter0', 'spitter1',
    'sentinel0', 'sentinel1', 'matron0', 'matron1', 'colossus0', 'colossus1', 'tyrant0', 'tyrant1', 'totem',
    'imp0', 'imp1', 'frostwisp0', 'frostwisp1']) makeWhite(n);
}

// ---------- decor ----------
function drawDecor() {
  // ---- Ashfields props ----
  make('stump', 40, 44, (c) => {
    shadow(c, 20, 39, 16, 4);
    poly(c, [[8, 38], [10, 18], [14, 14], [26, 14], [30, 18], [32, 38]], '#2a1c16', OUT, 2.5);
    c.strokeStyle = '#140c0a'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(15, 18); c.lineTo(14, 36); c.moveTo(22, 17); c.lineTo(23, 37); c.stroke();
    ellipse(c, 20, 15, 10, 3.5, '#4a3020', OUT, 2);
    c.strokeStyle = '#ff7a20'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(11, 28); c.lineTo(14, 25); c.moveTo(27, 32); c.lineTo(29, 27); c.stroke();
    poly(c, [[28, 20], [36, 8], [31, 19]], '#2a1c16', OUT, 1.5);
  });
  make('vent', 40, 26, (c) => {
    glowDot(c, 20, 13, 16, 'rgba(255,110,30,0.6)');
    ellipse(c, 20, 14, 15, 7, '#2a1a14', OUT, 2);
    ellipse(c, 20, 14, 9, 4, radial(c, 20, 14, 9, [[0, '#fff0a0'], [0.4, '#ff8a20'], [1, '#6a1a04']]));
    for (const [x, y] of [[9, 9], [31, 10], [14, 20]]) circle(c, x, y, 1.6, '#ffb040');
  });
  make('basalt', 34, 30, (c) => {
    shadow(c, 17, 26, 15, 4);
    poly(c, [[4, 26], [6, 12], [12, 6], [22, 8], [30, 14], [30, 26]], '#30282a', OUT, 2);
    poly(c, [[12, 6], [22, 8], [18, 14], [10, 12]], '#463a3a');
    c.strokeStyle = '#ff6a20'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(9, 20); c.lineTo(15, 17); c.lineTo(20, 22); c.stroke();
  });
  // ---- Rimewood props ----
  make('pine', 44, 70, (c) => {
    shadow(c, 22, 64, 16, 5);
    c.fillStyle = '#3a2a22'; c.fillRect(19, 52, 6, 12);
    for (let i = 0; i < 3; i++) {
      const y = 14 + i * 14, w = 10 + i * 6;
      poly(c, [[22, y - 12], [22 + w, y + 10], [22 - w, y + 10]], '#1e3a40', OUT, 2);
      poly(c, [[22, y - 12], [22 + w * 0.55, y + 2], [22 - w * 0.6, y + 3]], '#e8f6ff');
    }
  });
  make('icecluster', 36, 34, (c) => {
    shadow(c, 18, 30, 14, 3.5);
    glowDot(c, 18, 18, 16, 'rgba(140,220,255,0.35)');
    for (const [x, h, w] of [[11, 18, 4], [19, 26, 5], [26, 14, 4]]) {
      poly(c, [[x, 30 - h], [x + w, 30 - h * 0.35], [x + w * 0.4, 30], [x - w * 0.6, 30], [x - w, 30 - h * 0.35]], '#bfeaff', '#2a6a9a', 1.5);
      poly(c, [[x, 30 - h], [x + w, 30 - h * 0.35], [x, 30 - h * 0.3]], '#f4fcff');
    }
  });
  make('snowrock', 36, 28, (c) => {
    shadow(c, 18, 24, 16, 4);
    poly(c, [[4, 22], [8, 10], [18, 4], [30, 9], [33, 22]], '#3a4658', OUT, 2);
    c.beginPath(); c.moveTo(7, 12); c.quadraticCurveTo(18, 1, 31, 10); c.quadraticCurveTo(20, 9, 7, 12);
    c.fillStyle = '#eef8ff'; c.fill();
  });
  make('rock0', 36, 28, (c) => {
    shadow(c, 18, 24, 16, 4);
    poly(c, [[4, 22], [8, 10], [18, 4], [30, 9], [33, 22]], '#3a3a4e', OUT, 2);
    poly(c, [[9, 12], [18, 6], [27, 10], [20, 14]], '#52526a');
  });
  make('rock1', 24, 20, (c) => {
    shadow(c, 12, 17, 10, 3);
    poly(c, [[3, 16], [6, 7], [14, 3], [21, 8], [21, 16]], '#34344a', OUT, 2);
  });
  make('grass', 28, 22, (c) => {
    c.strokeStyle = '#2f5a4a'; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = 5 + i * 3;
      c.beginPath(); c.moveTo(x, 20); c.quadraticCurveTo(x + (rnd() - 0.5) * 8, 10, x + (rnd() - 0.5) * 10, 3 + rnd() * 6); c.stroke();
    }
  });
  make('shroom', 24, 24, (c) => {
    glowDot(c, 12, 10, 12, 'rgba(90,255,220,0.5)');
    c.fillStyle = '#c8e8e0'; c.fillRect(10, 11, 4, 10);
    c.beginPath(); c.arc(12, 11, 8, Math.PI, 0); c.fillStyle = '#3affd0'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    circle(c, 9, 8, 1.4, '#e0fff8'); circle(c, 15, 7, 1.1, '#e0fff8');
  });
  make('bones', 32, 20, (c) => {
    c.strokeStyle = '#cfc6b0'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(4, 15); c.lineTo(22, 6); c.moveTo(10, 4); c.lineTo(26, 16); c.stroke();
    circle(c, 25, 11, 5, '#ddd4be', OUT, 1.5);
    circle(c, 23.5, 10, 1.2, OUT); circle(c, 26.5, 10, 1.2, OUT);
  });
  make('pillar', 40, 72, (c) => {
    shadow(c, 20, 66, 18, 5);
    c.fillStyle = '#3e3a56'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(9, 18, 22, 48, 2); c.fill(); c.stroke();
    c.fillStyle = '#4e4a68'; c.fillRect(13, 20, 4, 44);
    poly(c, [[7, 18], [10, 8], [18, 12], [24, 4], [33, 18]], '#4a4664', OUT, 2.5);
    c.fillStyle = '#2f5a4a'; c.beginPath(); c.ellipse(16, 60, 9, 4, 0, 0, TAU); c.fill();
  });
  make('flower', 20, 20, (c) => {
    glowDot(c, 10, 9, 9, 'rgba(255,120,200,0.45)');
    c.strokeStyle = '#2f5a4a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(10, 19); c.lineTo(10, 10); c.stroke();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; circle(c, 10 + Math.cos(a) * 3.5, 8 + Math.sin(a) * 3.5, 2.6, '#ff8ad0'); }
    circle(c, 10, 8, 2, '#fff2a0');
  });
}

// ---------- digits for damage numbers ----------
function drawDigits() {
  const chars = '0123456789!';
  for (const ch of chars) {
    make('d' + ch, 18, 24, (c) => {
      c.font = '900 22px "Arial Black", Arial, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 5; c.strokeStyle = '#000'; c.lineJoin = 'round';
      c.strokeText(ch, 9, 13); c.fillStyle = '#fff'; c.fillText(ch, 9, 13);
    });
  }
}

// ---------- weapon/passive icons (atlas regions reused for HTML UI) ----------
function iconBG(c, col) {
  c.fillStyle = radial(c, 24, 24, 30, [[0, col], [1, '#120a1c']]);
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
  I('emberBolt', '#6a2a0a', (c) => { blit(c, 'bolt', 30, 18, 0.9); blit(c, 'bolt', 18, 30, 1.1); });
  I('haloBlades', '#0a3a5a', (c) => { blit(c, 'blade', 16, 16, 0.8, 0); blit(c, 'blade', 32, 32, 0.8, 3); c.strokeStyle = 'rgba(160,230,255,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(24, 24, 13, 0, TAU); c.stroke(); });
  I('stormCoil', '#2a2a6a', (c) => { c.strokeStyle = '#bfe0ff'; c.lineWidth = 3; c.shadowColor = '#6ab0ff'; c.shadowBlur = 8; c.beginPath(); c.moveTo(28, 6); c.lineTo(16, 24); c.lineTo(26, 24); c.lineTo(18, 42); c.stroke(); });
  I('frostPulse', '#0a3a5a', (c) => { blit(c, 'freeze', 24, 24, 1.1); c.strokeStyle = 'rgba(180,240,255,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(24, 24, 19, 0, TAU); c.stroke(); });
  I('wispSwarm', '#0a4a3a', (c) => { blit(c, 'wisp', 16, 30); blit(c, 'wisp', 30, 16); blit(c, 'wisp', 32, 32, 0.7); });
  I('crescentArc', '#5a0a1a', (c) => { blit(c, 'slash', 26, 24, 0.33); });
  I('starfall', '#5a2a0a', (c) => { blit(c, 'meteor', 22, 26, 0.9); blit(c, 'spark', 36, 12, 0.7); });
  I('moonglaive', '#2a1a5a', (c) => { blit(c, 'glaive', 24, 24, 0.85); });
  I('prismBeam', '#4a0a4a', (c) => { const cols = ['#ff6a8a', '#ffd060', '#6affc0', '#6ac0ff']; cols.forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(8, 40 - i * 3); c.lineTo(42, 10 + i * 4); c.stroke(); }); circle(c, 10, 38, 5, '#fff'); });
  I('bloomMines', '#5a0a3a', (c) => { blit(c, 'mine', 24, 24, 1.1); });
  I('sparkDrones', '#2a3a1a', (c) => { blit(c, 'drone', 24, 24, 1.05); });
  I('sunRing', '#6a3a0a', (c) => { c.strokeStyle = '#ffcf6a'; c.lineWidth = 4; c.setLineDash([6, 4]); c.beginPath(); c.arc(24, 24, 15, 0, TAU); c.stroke(); glowDot(c, 24, 24, 10, 'rgba(255,180,60,0.9)'); });
  I('iceLance', '#0a2a4a', (c) => { blit(c, 'icicle', 24, 24, 1.3, -0.7); blit(c, 'icicle', 18, 32, 0.9, -0.7); });
  I('sanctum', '#5a4a0a', (c) => { blit(c, 'feather', 24, 18, 1); blit(c, 'feather', 22, 30, 1, 0.4); });
  // fusions
  I('cataclysm', '#7a1a00', (c) => { blit(c, 'meteor', 24, 24, 1.05); blit(c, 'bolt', 34, 14, 0.8); blit(c, 'bolt', 12, 34, 0.7); });
  I('thousandEdges', '#003a6a', (c) => { for (let i = 0; i < 6; i++) blit(c, 'blade', 24 + Math.cos(i) * 13, 24 + Math.sin(i) * 13, 0.55, i); });
  I('tempestHeart', '#1a2a7a', (c) => { blit(c, 'freeze', 24, 24, 1); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(34, 4); c.lineTo(26, 20); c.lineTo(34, 20); c.lineTo(24, 40); c.stroke(); });
  I('seraphChoir', '#4a0a5a', (c) => { blit(c, 'wisp', 24, 24, 1.4); c.strokeStyle = '#ffe0ff'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(24 + Math.cos(a) * 9, 24 + Math.sin(a) * 9); c.lineTo(24 + Math.cos(a) * 21, 24 + Math.sin(a) * 21); c.stroke(); } });
  I('eclipseDisc', '#3a0a3a', (c) => { circle(c, 24, 24, 15, '#05010a', '#ffb060', 3); blit(c, 'glaive', 24, 24, 0.6); });
  I('hiveFoundry', '#3a3a0a', (c) => { blit(c, 'drone', 30, 18, 0.9); blit(c, 'mine', 16, 32, 0.8); });
  I('glacierSpire', '#0a3a6a', (c) => { for (let i = 0; i < 5; i++) blit(c, 'icicle', 24, 24, 1, (i / 5) * TAU); });
  // passives
  I('might', '#6a1a0a', (c) => { glowDot(c, 24, 24, 18, 'rgba(255,90,40,0.9)'); poly(c, [[24, 10], [33, 24], [24, 38], [15, 24]], '#ffb070', OUT, 2); });
  I('haste', '#3a3a4a', (c) => { circle(c, 24, 24, 14, '#d0d8e8', OUT, 2.5); c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.moveTo(24, 24); c.lineTo(24, 14); c.moveTo(24, 24); c.lineTo(31, 28); c.stroke(); });
  I('reach', '#0a3a4a', (c) => { circle(c, 24, 24, 15, 'rgba(150,230,255,0.25)', '#bfefff', 2.5); circle(c, 24, 24, 7, '#e0faff', OUT, 2); });
  I('velocity', '#2a4a5a', (c) => { blit(c, 'feather', 24, 24, 1.2, -0.6); });
  I('multicast', '#4a0a5a', (c) => { poly(c, [[24, 6], [34, 24], [24, 42], [14, 24]], '#e6b0ff', OUT, 2); poly(c, [[24, 6], [34, 24], [24, 24]], '#fff'); });
  I('vitality', '#3a2a0a', (c) => { blit(c, 'heart', 24, 25, 1.3); });
  I('regen', '#0a4a1a', (c) => { c.fillStyle = '#6aff8a'; c.fillRect(20, 10, 8, 28); c.fillRect(10, 20, 28, 8); });
  I('swift', '#3a2a1a', (c) => { poly(c, [[12, 34], [16, 14], [26, 14], [26, 28], [36, 30], [36, 36], [12, 36]], '#a0703a', OUT, 2); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, 20); c.lineTo(12, 20); c.moveTo(2, 28); c.lineTo(10, 28); c.stroke(); });
  I('magnet', '#1a2a5a', (c) => { blit(c, 'magnet', 24, 24, 1.3); });
  I('luck', '#1a4a1a', (c) => { for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.78; circle(c, 24 + Math.cos(a) * 7, 24 + Math.sin(a) * 7, 7, '#5ad06a', OUT, 2); } circle(c, 24, 24, 3, '#2a6a2a'); });
  I('crit', '#5a1a0a', (c) => { circle(c, 24, 24, 15, null, '#ff6a4a', 3); circle(c, 24, 24, 7, null, '#ff6a4a', 3); circle(c, 24, 24, 2.5, '#fff'); });
  I('duration', '#4a3a0a', (c) => { poly(c, [[14, 8], [34, 8], [24, 24], [34, 40], [14, 40], [24, 24]], '#f0d090', OUT, 2.5); });
  I('armor', '#3a3a3a', (c) => { poly(c, [[24, 6], [38, 12], [36, 28], [24, 42], [12, 28], [10, 12]], '#9aa0b0', OUT, 2.5); poly(c, [[24, 10], [34, 14], [33, 27], [24, 37]], '#c8ccd8'); });
  I('growth', '#2a1a4a', (c) => { c.fillStyle = '#7a4aca'; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.roundRect(11, 10, 26, 30, 3); c.fill(); c.stroke(); c.fillStyle = '#e8dcff'; c.fillRect(14, 12, 4, 26); glowDot(c, 28, 24, 7, 'rgba(255,255,160,0.9)'); });
  I('greed', '#4a3a0a', (c) => { blit(c, 'cinder', 18, 28, 1.4); blit(c, 'cinder', 30, 20, 1.4); });
  I('pact', '#3a0010', (c) => { glowDot(c, 24, 24, 20, 'rgba(255,30,80,0.8)'); poly(c, star(24, 24, 16, 6, 5, -Math.PI / 2), '#1a0008', '#ff3a6a', 2); });
  I('overcharge', '#4a3a0a', (c) => { glowDot(c, 24, 24, 20, 'rgba(255,220,90,0.9)'); poly(c, [[26, 6], [14, 26], [23, 26], [20, 42], [34, 20], [25, 20]], '#fff6c0', OUT, 2); });
  I('heal', '#4a0a1a', (c) => { blit(c, 'heart', 24, 25, 1.3); });
  I('cinderBag', '#4a2a0a', (c) => { blit(c, 'cinder', 24, 24, 2); });
}

// ---------- ground tile (separate texture for TilingSprite) ----------
export function makeGroundCanvas(pal) {
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
  c.fillStyle = radial(c, S / 2, S / 2, S * 0.72, [[0, 'rgba(0,0,0,0)'], [0.45, 'rgba(0,0,0,0)'], [0.8, 'rgba(4,2,10,0.55)'], [1, 'rgba(4,2,10,0.9)']]);
  c.fillRect(0, 0, S, S);
  return g;
}

export function buildAtlas() {
  drawFX();
  drawProjectiles();
  drawPickups();
  drawCharacters();
  drawEnemies();
  drawDecor();
  drawDigits();
  drawIcons();
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
