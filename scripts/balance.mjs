#!/usr/bin/env node
// Headless balance harness: runs seeded bot games (window.__sim, dev server only) in parallel
// Chromium pages and prints win/survival statistics per (skill, char, stage, difficulty, meta, heat) cell.
//
//   npm run balance -- --url http://localhost:5173 --runs 12 --skills novice,average,skilled,expert \
//     --chars warden --stages gloam --difficulty normal --meta 0 --heat 0 --secs 900 --workers 4 --out res.json
//
// Every list option takes comma-separated values; the harness runs the full cross product.
import { writeFileSync, appendFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def;
};
const list = (name, def) => String(arg(name, def)).split(',').map((s) => s.trim()).filter(Boolean);

if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Usage: node scripts/balance.mjs [--url U] [--runs N] [--skills a,b] [--chars a,b] [--stages a,b]\n'
    + '  [--difficulty a,b] [--meta 0,0.5] [--heat 0,3] [--secs S] [--workers W] [--dt 0.0333] [--seed0 0]\n'
    + '  [--timeout SECS_PER_RUN] [--out file.json] [--stand: bots never move, to prove idling cannot win] [--quiet]');
  process.exit(0);
}

const URL_ = arg('url', 'http://localhost:5173');
const RUNS = +arg('runs', 12);
const SKILLS = list('skills', 'novice,average,skilled,expert');
const CHARS = list('chars', 'warden');
const STAGES = list('stages', 'gloam');
const DIFFS = list('difficulty', 'normal');
const METAS = list('meta', '0').map(Number);
const HEATS = list('heat', '0').map(Number);
const SECS = +arg('secs', 1000);
const TUNE_ARG = Object.fromEntries(String(arg('tune', '')).split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [k, +v]; }));
const WORKERS = Math.max(1, +arg('workers', 4));
// Fast mode: dt 0.1 matches dt 0.05 outcomes (checked) at 2x the speed; dt 0.2 distorts results, do not use.
const DT = +arg('dt', 0.1);
const SEED0 = +arg('seed0', 0);
const RUN_TIMEOUT_MS = +arg('timeout', 900) * 1000;
const OUT = arg('out', '');
const QUIET = argv.includes('--quiet');

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall through */ }
  return import('/opt/node-tools/node_modules/playwright/index.mjs');
}

const pw = await loadPlaywright();
const chromium = pw.chromium || pw.default?.chromium;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

const CHAR_IDS = ['warden', 'oracle', 'tinker', 'reaver', 'dancer', 'bellwright', 'hunter', 'hearthkeeper', ...CHARS];
const seedSave = JSON.stringify({
  cinders: 0, meta: {}, fusions: {}, feats: {}, seen: {}, daily: {}, records: {}, skins: {}, heatSel: {},
  hints: { move: true, gems: true, kindle: true, flare: true, chest: true },
  unlocked: Object.fromEntries(CHAR_IDS.map((c) => [c, true])),
  stages: Object.fromEntries([...STAGES, 'gloam', 'ashfields', 'rimewood'].map((s) => [s, true])),
  heatMax: Object.fromEntries(STAGES.map((s) => [s, 10])),
  lastStage: STAGES[0],
});

async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript((s) => { try { localStorage.setItem('emberwake_save_v1', s); } catch { /* ignore */ } }, seedSave);
  const page = await context.newPage();
  page.on('pageerror', (e) => { if (!QUIET) console.error('[pageerror]', String(e).slice(0, 200)); });
  await page.goto(URL_, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__sim === 'function', null, { timeout: 120000 });
  return { context, page };
}

// ---------- job queue ----------
const cells = [];
for (const skill of SKILLS) for (const char of CHARS) for (const stage of STAGES) for (const difficulty of DIFFS) {
  for (const meta of METAS) for (const heat of HEATS) cells.push({ skill, char, stage, difficulty, meta, heat });
}
const cellKey = (c) => `${c.skill}|${c.char}|${c.stage}|${c.difficulty}|${c.meta}|${c.heat}`;
const jobs = [];
for (let seed = 1; seed <= RUNS; seed++) for (const cell of cells) jobs.push({ cell, seed: seed + SEED0 });
const results = new Map(cells.map((c) => [cellKey(c), { cell: c, runs: [], errors: 0 }]));
let done = 0;
const t0 = Date.now();

async function runOne(slot, job) {
  const { cell, seed } = job;
  const opts = { skill: cell.skill, difficulty: cell.difficulty, stage: cell.stage, heat: cell.heat, meta: cell.meta, seed, dt: DT, tune: TUNE_ARG, stand: argv.includes('--stand') };
  let timer;
  const guard = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('run timeout')), RUN_TIMEOUT_MS); });
  try {
    return await Promise.race([slot.page.evaluate(([s, c, o]) => window.__sim(s, c, o), [SECS, cell.char, opts]), guard]);
  } finally { clearTimeout(timer); }
}

async function worker(id) {
  let slot = null;
  while (jobs.length) {
    const job = jobs.shift();
    let res = null, err = null;
    for (let attempt = 0; attempt < 2 && !res; attempt++) {
      try {
        if (!slot) slot = await openPage();
        res = await runOne(slot, job);
      } catch (e) {
        err = e;
        if (slot) { await slot.context.close().catch(() => {}); slot = null; }
      }
    }
    const entry = results.get(cellKey(job.cell));
    if (res) { entry.runs.push(res); if (OUT) appendFileSync(OUT + 'l', JSON.stringify({ cell: job.cell, seed: job.seed, tune: TUNE_ARG, ...res, series: undefined, lvl5: (res.series.find((x) => x.t === 300) || {}).lvl, lvl10: (res.series.find((x) => x.t === 600) || {}).lvl }) + '\n'); }
    else { entry.errors++; console.error(`[w${id}] ${cellKey(job.cell)} seed ${job.seed} failed: ${String(err).slice(0, 200)}`); }
    done++;
    if (!QUIET && res) {
      const tag = res.win ? 'WIN ' : res.dead ? 'dead' : 'time';
      console.error(`[${done}/${done + jobs.length}] ${cellKey(job.cell)} s${job.seed} ${tag} t=${res.time}s lv${res.level} kills=${res.kills} wall=${(res.wallMs / 1000).toFixed(0)}s${res.killedBy ? ' by ' + res.killedBy : ''}`);
    }
  }
  if (slot) await slot.context.close().catch(() => {});
}

// ---------- stats ----------
const pct = (a, p) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f0 = (v) => (Number.isFinite(v) ? String(Math.round(v)) : '-');
const mmss = (v) => (Number.isFinite(v) ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : '-');
const killerName = (k) => String(k || '?').replace(/^touch:/, '').replace(/^shot:/, 'shot:');

function summarize(runs, errors) {
  const n = runs.length, times = runs.map((r) => r.time);
  const killers = {};
  for (const r of runs) if (r.dead) killers[killerName(r.killedBy)] = (killers[killerName(r.killedBy)] || 0) + 1;
  return {
    n, errors,
    winPct: (100 * runs.filter((r) => r.win).length) / (n || 1),
    deadPct: (100 * runs.filter((r) => r.dead).length) / (n || 1),
    timedOutPct: (100 * runs.filter((r) => r.timedOut).length) / (n || 1),
    p25: pct(times, 0.25), median: pct(times, 0.5), p75: pct(times, 0.75),
    lvl5: mean(runs.map((r) => (r.series.find((x) => x.t === 300) || {}).lvl).filter(Number.isFinite)), lvl10: mean(runs.map((r) => (r.series.find((x) => x.t === 600) || {}).lvl).filter(Number.isFinite)),
    objPct: (100 * runs.filter((r) => r.objDone).length) / (n || 1), objAt: mean(runs.filter((r) => r.objDone && r.objAt).map((r) => r.objAt)),
    level: mean(runs.map((r) => r.level)), kills: mean(runs.map((r) => r.kills)), cinders: mean(runs.map((r) => r.cinders)),
    wallMs: mean(runs.map((r) => r.wallMs)),
    killers: Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}x${v}`).join(' '),
  };
}

function printTable(rows) {
  const head = ['cell', 'n', 'win%', 'obj%', 'objT', 'dead%', 'tout%', 'p25', 'med', 'p75', 'lvl', 'L@5', 'L@10', 'kills', 'cinders', 'wall s', 'top killers'];
  const body = rows.map(([label, s]) => [label, `${s.n}${s.errors ? '+' + s.errors + 'err' : ''}`, f0(s.winPct), f0(s.objPct), mmss(s.objAt), f0(s.deadPct), f0(s.timedOutPct),
    mmss(s.p25), mmss(s.median), mmss(s.p75), f0(s.level), f0(s.lvl5), f0(s.lvl10), f0(s.kills), f0(s.cinders), f0(s.wallMs / 1000), s.killers]);
  const w = head.map((h, i) => Math.max(h.length, ...body.map((r) => String(r[i]).length)));
  const line = (r) => r.map((c, i) => (i === 0 || i === r.length - 1 ? String(c).padEnd(w[i]) : String(c).padStart(w[i]))).join('  ');
  console.log(line(head));
  console.log(w.map((x) => '-'.repeat(x)).join('  '));
  for (const r of body) console.log(line(r));
}

// ---------- go ----------
try {
  await Promise.all(Array.from({ length: Math.min(WORKERS, jobs.length) }, (_, i) => worker(i)));
} finally {
  await browser.close().catch(() => {});
}

const rows = [];
for (const { cell, runs, errors } of results.values()) {
  rows.push([`${cell.skill} ${cell.char}/${cell.stage} ${cell.difficulty} m${cell.meta} h${cell.heat}`, summarize(runs, errors), cell]);
}
console.log(`\nBalance: ${RUNS} seeds/cell, secs=${SECS}, ${((Date.now() - t0) / 1000).toFixed(0)}s wall, ${WORKERS} workers\n`);
printTable(rows);
// combined summary per skill (across all other dimensions)
const bySkill = new Map();
for (const { cell, runs, errors } of results.values()) {
  const e = bySkill.get(cell.skill) || { runs: [], errors: 0 };
  e.runs.push(...runs); e.errors += errors; bySkill.set(cell.skill, e);
}
if (cells.length > SKILLS.length) {
  console.log('\nCombined by skill:');
  printTable([...bySkill].map(([k, e]) => [k, summarize(e.runs, e.errors)]));
}
if (OUT) {
  writeFileSync(OUT, JSON.stringify({
    args: { URL: URL_, RUNS, SECS, SKILLS, CHARS, STAGES, DIFFS, METAS, HEATS },
    cells: rows.map(([, s, cell]) => ({ ...cell, summary: s, runs: results.get(cellKey(cell)).runs })),
  }, null, 1));
  console.log(`\nWrote ${OUT}`);
}
