// Headless contrast check. Serves nothing: it talks to the Vite dev server.
import { spawn } from 'node:child_process';
import { PAL, PLAYER, REWARD, AFFIX_TINT, ELITE_HALO, BOSS_HALO } from '../src/palette.js';

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function lab(hex) {
  let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  r = lin(r); g = lin(g); b = lin(b);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const hexOf = (n) => '#' + n.toString(16).padStart(6, '0');
const dE = (a, b) => {
  const A = lab(hexOf(a)), B = lab(hexOf(b));
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};

const fails = [];
const ember = [PAL.EMBER_D, PAL.EMBER, PAL.EMBER_L, PAL.EMBER_H];
const hostileSignal = [PAL.HFIRE_D, PAL.HFIRE_B, PAL.HFIRE, PAL.HFIRE_H, PAL.HEYE, PAL.HGLARE, PAL.HEYE_D];
function minPair(as, bs) {
  let m = 99, pair = '';
  for (const a of as) for (const b of bs) {
    const d = dE(a, b);
    if (d < m) { m = d; pair = hexOf(a) + ' ' + hexOf(b); }
  }
  return { m, pair };
}
const checks = [
  ['ember vs hostile fire/signal', minPair(ember, hostileSignal), 20],
  ['reward vs hostile fire/signal', minPair(Object.values(REWARD), hostileSignal), 20],
  ['player vs hostile fire/signal', minPair(Object.values(PLAYER), hostileSignal), 20],
  ['glare vs gold', { m: dE(PAL.HGLARE, PAL.R_GOLD), pair: '' }, 20],
];
const halos = [BOSS_HALO, ELITE_HALO, ...Object.values(AFFIX_TINT)];
let haloMin = 99;
for (let i = 0; i < halos.length; i++) for (let j = i + 1; j < halos.length; j++) haloMin = Math.min(haloMin, dE(halos[i], halos[j]));
checks.push(['halo pairwise', { m: haloMin, pair: '' }, 25]);
const all = Object.values(PAL);
let anyMin = 99, anyPair = '';
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  const d = dE(all[i], all[j]);
  if (d < anyMin) { anyMin = d; anyPair = hexOf(all[i]) + ' ' + hexOf(all[j]); }
}
checks.push(['any two swatches', { m: anyMin, pair: anyPair }, 2.5]);
console.log('ΔE');
for (const [name, { m, pair }, min] of checks) {
  const ok = m + 1e-6 >= min;
  console.log((ok ? '  ok ' : '  FAIL ') + name + ' ' + m.toFixed(1) + (pair ? ' (' + pair + ')' : '') + '  min ' + min);
  if (!ok) fails.push(name);
}

const port = 9223;
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  `--remote-debugging-port=${port}`, '--window-size=800,600', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* booting */ }
    await sleep(150);
  }
  throw new Error('no chrome page');
}
const page = await target();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve);
  ws.addEventListener('error', reject);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const msgId = ++id;
  pending.set(msgId, { resolve, reject });
  ws.send(JSON.stringify({ id: msgId, method, params }));
});
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
};
await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: 'http://localhost:5173/scripts/contrast.html' });
let text = '';
for (let i = 0; i < 80; i++) {
  text = await ev(`document.getElementById('out') ? document.getElementById('out').textContent : ''`);
  if (text && text !== 'running' && text.startsWith('{')) break;
  await sleep(250);
}
ws.close();
chrome.kill('SIGKILL');
if (!text || !text.startsWith('{')) {
  console.error('contrast page did not finish');
  process.exit(1);
}
const report = JSON.parse(text);
const s = report.summary;
console.log('grounds', Object.fromEntries(Object.entries(report.grounds).map(([k, v]) => [k, '#' + v.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')])));
console.log('contrast');
console.log('  enemy body  min', s.enemyBody.v, s.enemyBody.name, 'on', s.enemyBody.bodyAt);
console.log('  enemy elite min', s.enemyElite.v, s.enemyElite.name, 'on', s.enemyElite.eliteAt);
console.log('  pickup      min', s.pickup.v, s.pickup.name, 'on', s.pickup.at);
console.log('  bearer      min', s.bearer.v, s.bearer.name, 'on', s.bearer.at);
console.log('  props', report.propMin, report.propMinAt, '…', report.propMax, report.propMaxAt);
if (report.fails.length) {
  console.log('FAIL');
  for (const f of report.fails.slice(0, 40)) console.log(' ', f);
  if (report.fails.length > 40) console.log('  …', report.fails.length - 40, 'more');
  process.exit(1);
}
if (fails.length) process.exit(1);
console.log('contrast ok');
