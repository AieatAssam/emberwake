// Dev-only headless balance simulator. Loaded only in `vite dev`.
// Usage from the console / playwright:  await __sim(600, 'warden')
// Runs the real Game.update loop with a kiting, gem-collecting bot that auto-drafts.
export function install(startRun, getGame) {
  window.__sim = async (secs = 600, charId = 'warden', opts = {}) => {
    startRun(charId);
    const g = getGame(), ui = g.ui;
    ui.close();
    ui.showLevelUp = (gg) => {
      const c = gg.buildChoices();
      const w = c.find((x) => x.kind === 'weapon');
      gg.applyChoice(w && Math.random() < 0.6 ? w : c[0]);
    };
    ui.showChest = (gg, res) => gg.applyChest(res);
    ui.showResults = () => {};
    ui.showVictory = () => {};
    const log = [], spikes = [];
    let ang = 0, minHp = 1e9, upd = 0, worst = 0;
    const t0 = performance.now();
    for (let step = 0; step < secs * 60 && !g.dead; step++) {
      ang += 0.012;
      const P = g.player;
      let cx = 0, cy = 0, n = 0;
      for (const e of g.enemies) {
        if (e.inert) continue;
        const dx = e.x - P.x, dy = e.y - P.y;
        const rr = e.boss ? 320 : e.elite ? 230 : 170, w = e.boss ? 12 : e.elite ? 5 : 1;
        if (dx * dx + dy * dy < rr * rr) { cx += dx * w; cy += dy * w; n += w; }
      }
      let mx = Math.cos(ang), my = Math.sin(ang);
      if (n > 2) { const l = Math.hypot(cx, cy) || 1; mx = mx * 0.4 - cx / l; my = my * 0.4 - cy / l; }
      else {
        let best = null, bd = 400 * 400;
        for (const k of g.pickups) { if (!k.alive) continue; const d = (k.x - P.x) ** 2 + (k.y - P.y) ** 2; if (d < bd) { bd = d; best = k; } }
        if (best) { mx = best.x - P.x; my = best.y - P.y; }
      }
      const ml = Math.hypot(mx, my) || 1, sp = g.stats.moveSpeed / 60;
      P.x += (mx / ml) * sp; P.y += (my / ml) * sp; P.fx = mx / ml; P.fy = my / ml;
      if (g.flare >= 100) g.triggerFlare();
      const before = { ...g.prof };
      const a = performance.now();
      g.update(1 / 60);
      const d = performance.now() - a;
      if (d > 8 && step > 60 && spikes.length < 12) {
        const parts = {};
        for (const k in g.prof) parts[k] = +(g.prof[k] - before[k]).toFixed(1);
        spikes.push({ t: Math.round(g.time), ms: +d.toFixed(1), en: g.enemies.length, fx: g.fx.length, parts });
      }
      upd += d; if (step > 60) worst = Math.max(worst, d);
      minHp = Math.min(minHp, P.hp);
      if (step % 30 === 0) for (const k in g.L) g.L[k].flush();
      if (step % 3600 === 0) {
        log.push(`${Math.round(g.time)}s lv${g.level} hp${Math.round(P.hp)}/${Math.round(g.stats.maxHp)} minHp${Math.round(minHp)} en${g.enemies.length} kills${g.kills} press${(g.pressure||1).toFixed(1)} fx${g.fx.length} pr${g.projectiles.length} [${g.weapons.map((w) => w.id + ':' + w.level).join(',')}]`);
        minHp = 1e9;
      }
      if (step % 300 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const frames = g.time * 60;
    const prof = {};
    for (const k in g.prof) prof[k] = (g.prof[k] / frames).toFixed(3);
    return {
      dead: g.dead, victory: g.victory, time: Math.round(g.time), level: g.level, kills: g.kills,
      msPerUpdate: (upd / frames).toFixed(3), worstMs: worst.toFixed(2), prof, wallMs: Math.round(performance.now() - t0),
      weapons: g.weapons.map((w) => `${w.id}:${w.level} dmg${Math.round(w.dmgDone)}`), passives: g.passives, pacts: g.pacts,
      overcharge: g.overcharge || 0, killedBy: g.lastHitBy, dmgTaken: g.dmgLog, spikes, log,
    };
  };
}
