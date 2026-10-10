// HTML overlay UI: menus, HUD, level-up drafts, chest reveals.
import { iconURL, spriteURL } from './atlas.js';
import { SEALS, KEEPSAKES, hasSeal, sealCount, DIFFICULTY, HEAT_MAX, MILESTONES, ETERNAL, eternalCost, reqMet, reqOf, CHARACTERS, WEAPONS, PASSIVES, PACTS, FUSIONS, META, FEATS, STAGES, BESTIARY, ENEMIES, MAX_WEAPON_LEVEL, dailyConfig } from './data.js';
import { KINDLE_TIERS } from './game.js';
import { save, persist, resetSave } from './save.js';
import { sfx, duck, initAudio, setMuted, setMusic, setVolumes } from './audio.js';
import { clearPressed, padMenu } from './input.js';
import { hapticsSupported } from './haptics.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const fmtNum = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)));

export class UI {
  constructor(handlers) {
    this.h = handlers; // { startRun(charId), quitToTitle() }
    this.screen = $('#screen');
    this.hud = $('#hud');
    this.modalOpen = false;
    this.lastInv = '';
    this.keyHandler = null;
    addEventListener('keydown', (e) => this.keyHandler && this.keyHandler(e));
    $('#pausebtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (this.game && !this.modalOpen) this.showPause(this.game); });
    $('#flarebtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); this.game && this.game.triggerFlare(); });
    this.padIdx = 0;
    const padLoop = () => { this.padNav(); requestAnimationFrame(padLoop); };
    requestAnimationFrame(padLoop);
  }

  // Gamepad menu navigation: D-pad/stick moves a highlight over clickable elements, A selects, B backs out
  padNav() {
    if (!this.modalOpen) return;
    const m = padMenu();
    if (!(m.up || m.down || m.left || m.right || m.a || m.b)) return;
    const els = [...this.screen.querySelectorAll('[data-a], input[type=checkbox]')].filter((el) => el.offsetParent && !el.disabled);
    if (!els.length) return;
    if (m.b) {
      const back = this.screen.querySelector('[data-a="back"], [data-a="resume"]');
      if (back) back.click(); else if (this.keyHandler) this.keyHandler({ code: 'Escape', key: 'Escape', preventDefault() {} });
      return;
    }
    const cur = this.screen.querySelector('.pad-focus');
    let i = cur ? els.indexOf(cur) : -1;
    if (m.up || m.left) i = i <= 0 ? els.length - 1 : i - 1;
    if (m.down || m.right) i = i < 0 || i >= els.length - 1 ? 0 : i + 1;
    if (m.a) {
      if (i < 0) i = 0;
      els[i].click();
      return;
    }
    if (cur) cur.classList.remove('pad-focus');
    els[i].classList.add('pad-focus');
    els[i].scrollIntoView({ block: 'nearest' });
    sfx.hover();
  }

  open(html, cls = '') {
    this.screen.className = 'show ' + cls;
    this.screen.innerHTML = html;
    this.modalOpen = true;
    if (this.game) this.game.paused = true;
    this.screen.querySelectorAll('button, .card').forEach((b) => b.addEventListener('pointerenter', () => sfx.hover()));
  }
  close() {
    duck(false);
    this.screen.className = '';
    this.screen.innerHTML = '';
    this.modalOpen = false;
    this.keyHandler = null;
    clearPressed();
    if (this.game) this.game.paused = false;
  }

  // ================= TITLE =================
  showTitle() {
    this.game = null;
    this.hud.classList.add('hidden');
    const s = save;
    this.open(`
      <div class="title-wrap">
        <div class="logo"><span class="ember-dot"></span>EMBERWAKE</div>
        <div class="tagline">The sun is dead. You carry the last Ember.<br>Burn brighter than the Gloam — or be swallowed by it.</div>
        <div class="lineup">${Object.entries(CHARACTERS).map(([id, c], i) => `<img class="${s.unlocked[id] ? '' : 'locked'}" style="--c:${c.color};animation-delay:${i * -0.4}s" src="${spriteURL(c.sprite, 2)}" alt="${c.name}" title="${s.unlocked[id] ? c.name + ', ' + c.title : 'Locked'}">`).join('')}</div>
        <div class="menu">
          <button class="btn primary" data-a="play">Kindle a Run</button>
          <button class="btn" data-a="daily">Daily Ember ${save.daily[dailyConfig().key] ? '<small>✓ today</small>' : '<small>+100 ✦</small>'}</button>
          <button class="btn" data-a="hearth">The Hearth <small>${s.cinders} ✦</small></button>
          <button class="btn" data-a="codex">Codex</button>
          <button class="btn" data-a="settings">Settings</button>
        </div>
        <div class="stats-line">Best ${fmtTime(s.best.time)} · ${s.totals.runs} runs · ${fmtNum(s.totals.kills)} slain · ${s.totals.wins} victories</div>
        <div class="howto kbd-only">WASD / Arrows to move · weapons fire on their own · <b>SPACE</b> to unleash your Flare · ESC pause</div>
        <div class="howto touch-only">Drag anywhere to move · weapons fire on their own · tap <b>✹</b> to unleash your Flare</div>
      </div>`, 'title');
    this.bind({
      play: () => this.showCharSelect(),
      daily: () => this.showDaily(),
      hearth: () => this.showHearth(),
      codex: () => this.showCodex(),
      settings: () => this.showSettings(),
    });
    this.keyHandler = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.showCharSelect(); } };
  }

  bind(map) {
    this.screen.querySelectorAll('[data-a]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        initAudio();
        sfx.select();
        const fn = map[el.dataset.a];
        if (fn) fn(el, ev);
      });
    });
  }

  // ================= CHARACTER SELECT =================
  showCharSelect() {
    let sel = Object.keys(CHARACTERS).find((k) => save.unlocked[k]) || 'warden';
    const render = () => {
      const cards = Object.entries(CHARACTERS).map(([id, c]) => {
        const un = save.unlocked[id];
        return `<div class="card char ${un ? '' : 'locked'} ${id === sel ? 'sel' : ''}" data-a="pick" data-id="${id}" style="--c:${c.color}">
          <img src="${spriteURL(c.sprite, 2)}" alt="">
          <div class="cname">${c.name}</div><div class="ctitle">${c.title}</div>
          ${un ? `<div class="cw"><img src="${iconURL(c.weapon)}">${WEAPONS[c.weapon].name}</div>` : `<div class="cost">${c.cost} ✦</div>${reqOf('chars', id) ? `<div class="req ${reqMet('chars', id, save) ? 'ok' : ''}">${reqMet('chars', id, save) ? '✓' : '🔒'} ${reqOf('chars', id).text}</div>` : ''}`}
          ${un && (save.records['char:' + id] || {}).wins ? `<button class="dawn-btn ${save.skins[id] === 'dawn' ? 'on' : ''}" data-a="skin" data-id="${id}" title="Dawn variant (earned by breaking the Eclipse)">☀ Dawn</button>` : ''}
        </div>`;
      }).join('');
      const c = CHARACTERS[sel];
      const un = save.unlocked[sel];
      this.open(`
        <div class="panel wide">
          <h2>Choose your Bearer</h2>
          <div class="char-grid">${cards}</div>
          <div class="char-detail" style="--c:${c.color}">
            <div><b>${c.name}, ${c.title}</b></div>
            <div>Starts with <b>${WEAPONS[c.weapon].name}</b> · ${c.bonus}</div>
            <div class="flare-desc">Flare — <b>${c.flareName}</b>: ${c.flareDesc}</div>
            ${c.perk ? `<div class="perk-desc">Perk — <b>${c.perkName}</b>: ${c.perkDesc}</div>` : ''}
          </div>
          <h3 class="stage-h">Stage</h3>
          <div class="stage-grid">${Object.entries(STAGES).map(([id, st]) => {
            const open = save.stages[id];
            const cur = (save.lastStage || 'gloam') === id;
            return `<div class="card stage ${open ? '' : 'locked'} ${cur ? 'sel' : ''}" data-a="stage" data-id="${id}" style="--c:${st.color}">
              <div class="stage-swatch" style="background:${st.ground.base}"><i style="background:${st.ground.blobs[0]}"></i><i style="background:${st.ground.blobs[2]}"></i></div>
              <div><div class="cname">${st.name}</div><div class="mdesc">${st.desc}</div>
              ${open ? '' : `<div class="cost">${st.cost} ✦ ${save.cinders >= st.cost && reqMet('stages', id, save) ? '· click to unlock' : ''}</div>${reqOf('stages', id) ? `<div class="req ${reqMet('stages', id, save) ? 'ok' : ''}">${reqMet('stages', id, save) ? '✓' : '🔒'} ${reqOf('stages', id).text}</div>` : ''}`}</div></div>`;
          }).join('')}</div>
          ${(() => {
            const st = save.lastStage || 'gloam', mx = save.heatMax[st] || 0, cur = Math.min(save.heatSel[st] || 0, mx);
            if (!mx) return `<div class="heat-row muted">Win on this stage to unlock <b>Heat</b> — harder runs for richer cinders.</div>`;
            return `<div class="heat-row"><span>Heat</span>${Array.from({ length: mx + 1 }, (_, i) => `<button class="heat-btn ${i === cur ? 'on' : ''}" data-a="heat" data-h="${i}">${i}</button>`).join('')}
              <em>${cur ? `+${cur * 25}% enemy health (growing +${cur * 3}%/min) · +${cur * 10}% spawns · more elites · weaker Overcharge · +${cur * 30}% cinders` : 'Standard difficulty'}</em></div>`;
          })()}
          ${(() => {
            const ks = Object.keys(KEEPSAKES).filter((k) => hasSeal(save, k, 'dawn'));
            if (!ks.length) return `<div class="heat-row muted">Win a stage to earn its <b>Dawn Seal</b> and a Keepsake to carry into any run.</div>`;
            return `<div class="heat-row"><span>Keepsake</span><button class="heat-btn ${!save.keepsakeSel ? 'on' : ''}" data-a="keep" data-k="">None</button>${ks.map((k) => `<button class="heat-btn ${save.keepsakeSel === k ? 'on' : ''}" data-a="keep" data-k="${k}" title="${esc(KEEPSAKES[k].desc)}">${KEEPSAKES[k].name}</button>`).join('')}
              <em>${save.keepsakeSel && KEEPSAKES[save.keepsakeSel] ? KEEPSAKES[save.keepsakeSel].desc : 'Choose one'}</em></div>`;
          })()}
          <div class="row">
            <button class="btn" data-a="back">Back</button>
            ${un ? `<button class="btn primary" data-a="go">Begin</button>`
              : `<button class="btn primary" data-a="buy" ${save.cinders < c.cost || !reqMet('chars', sel, save) ? 'disabled' : ''}>Unlock · ${c.cost} ✦</button>`}
            <button class="btn ghost" data-a="diff" title="${esc(DIFFICULTY[save.settings.difficulty || 'normal'].desc)}">${DIFFICULTY[save.settings.difficulty || 'normal'].name} ▸</button>
          </div>
          <div class="wallet">${save.cinders} ✦ cinders</div>
        </div>`);
      this.bind({
        pick: (el) => { sel = el.dataset.id; render(); },
        skin: (el, ev) => { ev.stopPropagation(); const id = el.dataset.id; save.skins[id] = save.skins[id] === 'dawn' ? '' : 'dawn'; persist(); sel = id; render(); },
        diff: () => { const ids = Object.keys(DIFFICULTY); save.settings.difficulty = ids[(ids.indexOf(save.settings.difficulty || 'normal') + 1) % ids.length]; persist(); sfx.select(); render(); },
        keep: (el) => { save.keepsakeSel = el.dataset.k; persist(); sfx.select(); render(); },
        heat: (el) => { save.heatSel[save.lastStage || 'gloam'] = +el.dataset.h; persist(); render(); },
        stage: (el) => {
          const id = el.dataset.id, st = STAGES[id];
          if (!save.stages[id]) {
            if (save.cinders < st.cost || !reqMet('stages', id, save)) { sfx.deny(); return; }
            save.cinders -= st.cost; save.stages[id] = true; sfx.purchase();
          }
          save.lastStage = id; persist(); render();
        },
        back: () => { sfx.back(); this.showTitle(); },
        go: () => { this.close(); this.h.startRun(sel); },
        buy: () => {
          if (save.cinders >= c.cost && reqMet('chars', sel, save)) { save.cinders -= c.cost; save.unlocked[sel] = true; persist(); sfx.purchase(); render(); } else sfx.deny();
        },
      });
      this.keyHandler = (e) => {
        const ids = Object.keys(CHARACTERS);
        if (e.code === 'ArrowRight' || e.code === 'KeyD') { sel = ids[(ids.indexOf(sel) + 1) % ids.length]; render(); }
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') { sel = ids[(ids.indexOf(sel) + ids.length - 1) % ids.length]; render(); }
        if ((e.code === 'Enter' || e.code === 'Space') && save.unlocked[sel]) { e.preventDefault(); initAudio(); this.close(); this.h.startRun(sel); }
        if (e.code === 'Escape') this.showTitle();
      };
    };
    render();
  }

  // ================= DAILY EMBER =================
  showDaily() {
    const d = dailyConfig(), c = CHARACTERS[d.charId], st = STAGES[d.stageId], rec = save.daily[d.key];
    const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    this.open(`
      <div class="panel">
        <h2>Daily Ember</h2>
        <div class="sub">${d.key} · the same fixed setup for every Bearer today</div>
        <div class="daily-grid">
          <img src="${spriteURL(c.sprite, 2)}" alt="">
          <div>
            <div><b style="color:${c.color}">${c.name}, ${c.title}</b>${save.unlocked[d.charId] ? '' : ' <small class="trial">free trial</small>'}</div>
            <div>Stage: <b>${st.name}</b></div>
            <div>Bonus weapon: <img class="inl" src="${iconURL(d.weapon)}"> <b>${WEAPONS[d.weapon].name}</b></div>
            <div>Sworn pacts: ${d.pacts.map((p) => `<b class="pactname">${PACTS[p].name}</b>`).join(', ')}</div>
            <div class="mdesc">${d.pacts.map((p) => PACTS[p].desc).join(' · ')}</div>
          </div>
        </div>
        <div class="daily-rec">${rec ? `Today's best: <b>${fmt(rec.time)}</b> · ${rec.kills} slain` : 'First run today pays <b>+100 ✦</b>'}</div>
        <div class="row"><button class="btn" data-a="back">Back</button><button class="btn primary" data-a="go">Begin</button></div>
      </div>`);
    this.bind({
      back: () => this.showTitle(),
      go: () => { this.close(); this.h.startRun(d.charId, d.stageId, { daily: d }); },
    });
    this.keyHandler = (e) => { if (e.code === 'Escape') this.showTitle(); };
  }

  // ================= HEARTH (meta shop) =================
  showHearth() {
    const render = () => {
      const items = Object.entries(META).map(([id, m]) => {
        const l = save.meta[id] || 0;
        const cost = Math.round(m.cost * (1 + l * 0.6));
        const maxed = l >= m.max;
        const pips = Array.from({ length: m.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
        return `<div class="card meta ${maxed ? 'maxed' : ''}" data-a="buy" data-id="${id}">
          <div class="mname">${m.name}</div><div class="mdesc">${m.desc}</div>
          <div class="pips">${pips}</div>
          <div class="mcost">${maxed ? 'MAX' : cost + ' ✦'}</div></div>`;
      }).join('');
      this.open(`
        <div class="panel wide">
          <h2>The Hearth</h2>
          <div class="sub">Cinders gathered in the Gloam feed the Hearth. Its warmth follows you into every run.</div>
          <div class="meta-grid">${items}</div>
          ${save.totals.wins >= 1 ? `<h3 class="stage-h">Eternal Embers <small>— an endless sink for the long game</small></h3><div class="meta-grid">${Object.entries(ETERNAL).map(([id, m]) => {
            const l = save.eternal[id] || 0, maxed = l >= m.max;
            return `<div class="card meta eternal ${maxed ? 'maxed' : ''}" data-a="ebuy" data-id="${id}"><div class="mname">${m.name} <span class="lv">${l}/${m.max}</span></div><div class="mdesc">${m.desc}</div><div class="mcost">${maxed ? 'MAX' : eternalCost(id, l) + ' ✦'}</div></div>`;
          }).join('')}</div>` : `<div class="heat-row muted">Win a run to light the <b>Eternal Embers</b>: an endless sink for spare cinders.</div>`}
          <div class="row"><button class="btn" data-a="back">Back</button><button class="btn ghost" data-a="refund">Refund all</button></div>
          <div class="wallet">${save.cinders} ✦ cinders</div>
        </div>`);
      this.bind({
        back: () => this.showTitle(),
        buy: (el) => {
          const id = el.dataset.id, m = META[id], l = save.meta[id] || 0;
          const cost = Math.round(m.cost * (1 + l * 0.6));
          if (l < m.max && save.cinders >= cost) { save.cinders -= cost; save.meta[id] = l + 1; persist(); sfx.purchase(); render(); } else sfx.deny();
        },
        ebuy: (el) => {
          const id = el.dataset.id, l = save.eternal[id] || 0, cost = l < ETERNAL[id].max ? eternalCost(id, l) : Infinity;
          if (save.cinders >= cost) { save.cinders -= cost; save.eternal[id] = l + 1; persist(); sfx.purchase(); render(); } else sfx.deny();
        },
        refund: () => {
          let back = 0;
          for (const id in save.meta) { const m = META[id]; for (let i = 0; i < save.meta[id]; i++) back += Math.round(m.cost * (1 + i * 0.6)); }
          save.cinders += back; save.meta = {}; persist(); render();
        },
      });
      this.keyHandler = (e) => { if (e.code === 'Escape') this.showTitle(); };
    };
    render();
  }

  // ================= CODEX =================
  showCodex() {
    const fus = Object.entries(FUSIONS).map(([id, f]) => {
      const known = save.fusions[id];
      return `<div class="card codex ${known ? '' : 'unknown'}">
        <img src="${iconURL(id)}" class="${known ? '' : 'sil'}">
        <div><div class="mname">${known ? f.name : '??? Ascension'}</div>
        <div class="recipe"><img src="${iconURL(f.parents[0])}"> ${WEAPONS[f.parents[0]].name} + <img src="${iconURL(f.parents[1])}"> ${WEAPONS[f.parents[1]].name}</div>
        <div class="mdesc">${known ? f.desc : 'Bring both weapons to max level, then open a chest.'}</div></div></div>`;
    }).join('');
    const weps = Object.entries(WEAPONS).map(([id, w]) => `<div class="card mini"><img src="${iconURL(id)}"><div><b>${w.name}</b><div class="mdesc">${w.desc}</div></div></div>`).join('');
    const pas = Object.entries(PASSIVES).map(([id, p]) => `<div class="card mini"><img src="${iconURL(id)}"><div><b>${p.name}</b><div class="mdesc">${p.desc} (max ${p.max})</div></div></div>`).join('');
    this.open(`
      <div class="panel wide scroll">
        <h2>Codex</h2>
        <h3>Ascensions — ${Object.keys(save.fusions).length}/${Object.keys(FUSIONS).length} discovered</h3>
        <div class="codex-grid">${fus}</div>
        <h3>Feats — ${Object.keys(save.feats).length}/${Object.keys(FEATS).length}</h3>
        <div class="mini-grid">${Object.entries(FEATS).map(([id, f]) => `<div class="card mini feat ${save.feats[id] ? 'done' : ''}"><div class="feat-ic">${save.feats[id] ? '★' : '☆'}</div><div><b>${f.name}</b><div class="mdesc">${f.desc} · ${f.reward} ✦</div></div></div>`).join('')}</div>
        <h3>Seals — ${sealCount(save)}/${Object.keys(STAGES).length * Object.keys(SEALS).length}</h3>
        <table class="dmg records seals"><tr><th>Stage</th>${Object.values(SEALS).map((x) => `<th title="${esc(x.desc)}"><img src="${iconURL(x.icon)}" alt="${x.name}"></th>`).join('')}<th>Keepsake</th></tr>
        ${Object.entries(STAGES).map(([id, st]) => `<tr><td style="color:${st.color}">${st.name}</td>${Object.keys(SEALS).map((k) => `<td class="${hasSeal(save, id, k) ? 'got' : 'no'}">${hasSeal(save, id, k) ? '✓' : '·'}</td>`).join('')}<td>${KEEPSAKES[id] ? (hasSeal(save, id, 'dawn') ? `${KEEPSAKES[id].name}<small> ${KEEPSAKES[id].desc}</small>` : '🔒') : '—'}</td></tr>`).join('')}</table>
        <h3>Records</h3>
        <table class="dmg records"><tr><th>Stage</th><th>Best time</th><th>Wins</th><th>Highest Heat cleared</th></tr>
        ${Object.entries(STAGES).map(([id, st]) => { const r = save.records['stage:' + id]; return `<tr><td style="color:${st.color}">${st.name}</td><td>${r ? fmtTime(r.time) : '—'}</td><td>${r ? r.wins : 0}</td><td>${r && r.heatWon >= 0 ? 'Heat ' + r.heatWon : '—'}</td></tr>`; }).join('')}</table>
        <table class="dmg records"><tr><th></th><th>Bearer</th><th>Runs</th><th>Wins</th><th>Best time</th></tr>
        ${Object.entries(CHARACTERS).map(([id, c]) => { const r = save.records['char:' + id]; return `<tr><td><img src="${spriteURL(c.sprite, 1)}" class="${save.unlocked[id] ? '' : 'sil'}"></td><td style="color:${c.color}">${save.unlocked[id] ? c.name : '???'}</td><td>${r ? r.runs : 0}</td><td>${r ? r.wins : 0}</td><td>${r ? fmtTime(r.time) : '—'}</td></tr>`; }).join('')}</table>
        <h3>Bestiary — ${Object.keys(BESTIARY).filter((k) => save.seen[k]).length}/${Object.keys(BESTIARY).length} encountered</h3>
        <div class="mini-grid">${Object.entries(BESTIARY).map(([id, b]) => {
          const seen = save.seen[id], tex = ENEMIES[id].tex + '0';
          return `<div class="card mini beast ${seen ? '' : 'unseen'}"><img src="${spriteURL(tex, 1)}" alt=""><div><b>${seen ? b.name : '???'}</b><div class="mdesc">${seen ? b.lore : 'Not yet encountered.'}</div></div></div>`;
        }).join('')}</div>
        <h3>Weapons</h3><div class="mini-grid">${weps}</div>
        <h3>Relics</h3><div class="mini-grid">${pas}</div>
        <h3>How the Gloam works</h3>
        <ul class="rules">
          <li><b>Kindle</b> — every kill feeds a streak. Higher streaks multiply cinders up to x2.5 (and XP at half strength). Stop killing for ~3s and it gutters out.</li>
          <li><b>Flare</b> — kills charge your Flare. Press SPACE when full to unleash your Bearer's ultimate.</li>
          <li><b>Ascension</b> — two max-level partner weapons fuse at the next chest into one Ascended weapon, freeing a slot.</li>
          <li><b>Dark Pacts</b> — rare blood-red draft cards. Power at a price, for the rest of the run.</li>
          <li><b>Totems</b> — golden obelisks in the dark hold relics: health, magnets, bombs, frost, flare.</li>
          <li><b>Elite affixes</b> — from 3:00 elites carry an aura: <span style="color:#40e0ff">swift</span>, <span style="color:#ff4060">vampiric</span> (regenerates), <span style="color:#7a9aff">warded</span> (resists damage) or <span style="color:#ff8a20">volatile</span> (bursts into embers on death).</li>
          <li><b>Ember Shrines</b> — glowing circles appear every few minutes. Hold your ground inside for 5s to earn a relic chest — but the dark answers.</li>
          <li><b>Overcharge</b> — once everything is maxed, power keeps climbing. Forever.</li>
        </ul>
        <div class="row"><button class="btn" data-a="back">Back</button></div>
      </div>`);
    this.bind({ back: () => this.showTitle() });
    this.keyHandler = (e) => { if (e.code === 'Escape') this.showTitle(); };
  }

  showSettings(fromPause = false) {
    const st = save.settings;
    const t = (k, label) => `<label class="toggle"><input type="checkbox" data-k="${k}" ${st[k] ? 'checked' : ''}><span>${label}</span></label>`;
    this.open(`
      <div class="panel">
        <h2>Settings</h2>
        <div class="difficulty"><span>Difficulty <small>(applies to your next run)</small></span>
          <div class="seg">${Object.entries(DIFFICULTY).map(([id, d]) => `<button type="button" class="${(st.difficulty || 'normal') === id ? 'on' : ''}" data-d="${id}">${d.name}</button>`).join('')}</div>
          <em>${esc(DIFFICULTY[st.difficulty || 'normal'].desc)}</em>
        </div>
        <label class="slider"><span>Master volume</span><input type="range" min="0" max="100" step="5" data-v="volume" value="${st.volume}"><b>${st.volume}%</b></label>
        <label class="slider"><span>Music volume</span><input type="range" min="0" max="100" step="5" data-v="musicVolume" value="${st.musicVolume}"><b>${st.musicVolume}%</b></label>
        ${t('muted', 'Mute all audio')}${t('music', 'Music')}${t('numbers', 'Damage numbers')}${t('shake', 'Screen shake')}${t('lowfx', 'Reduced effects (fewer particles, no screen flashes)')}${hapticsSupported ? t('haptics', 'Vibration (haptic feedback)') : ''}
        <p class="sub credits">Music: public-domain (CC0) tracks by yd, Sorth, cynicmusic, beardalaxy, congusbongus, Spring Spring and Pro Sensory via OpenGameArt.org.</p>
        <div class="row"><button class="btn" data-a="back">Back</button>${document.fullscreenEnabled ? '<button class="btn" data-a="fs">Fullscreen</button>' : ''}${fromPause ? '' : '<button class="btn ghost danger" data-a="wipe">Erase save</button>'}</div>
      </div>`);
    this.screen.querySelectorAll('button[data-d]').forEach((el) => el.addEventListener('click', () => { st.difficulty = el.dataset.d; persist(); sfx.select(); this.showSettings(fromPause); }));
    this.screen.querySelectorAll('input[data-v]').forEach((el) => el.addEventListener('input', () => {
      st[el.dataset.v] = +el.value; el.nextElementSibling.textContent = el.value + '%'; persist();
      setVolumes(st.volume / 100, st.musicVolume / 100);
    }));
    this.screen.querySelectorAll('input[data-k]').forEach((el) => el.addEventListener('change', () => {
      st[el.dataset.k] = el.checked; persist();
      setMuted(st.muted); setMusic(st.music);
    }));
    this.bind({
      back: () => (fromPause ? this.showPause(this.game) : this.showTitle()),
      fs: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); },
      // eslint-disable-next-line no-alert -- deliberate native confirmation for an irreversible wipe
      wipe: () => { if (confirm('Erase all progress?')) { resetSave(); this.showTitle(); } },
    });
    this.keyHandler = (e) => { if (e.code === 'Escape') (fromPause ? this.showPause(this.game) : this.showTitle()); };
  }

  // ================= IN-RUN =================
  beginRun(game) {
    this.game = game;
    this._hud = {};
    this.hud.classList.remove('hidden');
    this.lastInv = '';
    $('#flarebtn').style.display = matchMedia('(pointer: coarse)').matches ? 'block' : 'none';
  }

  // write-through cache: DOM is touched only when a displayed value actually changes
  set(sel, prop, val) {
    const c = this._hud || (this._hud = {});
    const key = sel + '|' + prop;
    if (c[key] === val) return;
    c[key] = val;
    const el = this._els?.[sel] || ((this._els || (this._els = {}))[sel] = document.querySelector(sel));
    if (prop === 'text') el.textContent = val;
    else if (prop === 'w') el.style.width = val;
    else if (prop[0] === '.') el.classList.toggle(prop.slice(1), val);
    else el.dataset[prop] = val;
  }

  updateHUD(g) {
    if (!g) return;
    this.set('#xpfill', 'w', (Math.min(1, g.xp / g.xpNext) * 100).toFixed(1) + '%');
    this.set('#lvl', 'text', 'LV ' + g.level);
    this.set('#timer', 'text', fmtTime(g.time));
    this.set('#timer', '.endless', g.time > 900);
    this.set('#goal', 'text', goalText(g));
    const ob = g.obj.hud();
    this.set('#objective', '.on', !!ob);
    if (ob) {
      this.set('#objective .ob-title', 'text', ob.title);
      this.set('#objective .ob-count', 'text', ob.count);
      this.set('#objective .ob-bar > div', 'w', Math.round(Math.max(0, Math.min(1, ob.prog)) * 100) + '%');
      this.set('#objective .ob-sub', 'text', ob.sub);
      this.set('#objective', '.done', ob.state === 'done');
      this.set('#objective', '.warn', ob.state === 'warn');
    }
    this.set('#goal', '.alarm', g.hollowN > 0 || (!!g.hollowAt && g.hollowAt - g.time < 30 && g.time > 900));
    this.set('#kills', 'text', fmtNum(g.kills));
    this.set('#cinders', 'text', fmtNum(g.cinders));
    // kindle
    const on = g.combo >= 10;
    this.set('#kindle', '.on', on);
    if (on) {
      const tier = KINDLE_TIERS[g.kindleTier];
      this.set('#kindle', 'tier', String(g.kindleTier));
      this.set('#kindle .mul', 'text', 'x' + +tier.mul.toFixed(2));
      this.set('#kindle .cnt', 'text', g.combo + ' streak');
      this.set('#kindle .bar > div', 'w', Math.max(0, Math.round((g.comboT / 2.8) * 50) * 2) + '%');
      const next = KINDLE_TIERS[g.kindleTier + 1];
      this.set('#kindle .next', 'text', next ? `next x${next.mul} @ ${next.at}` : 'MAX');
    }
    // flare
    this.set('#flare .fill', 'w', Math.round(g.flare) + '%');
    this.set('#flare', '.ready', g.flare >= 100);
    this.set('#flarebtn', '.ready', g.flare >= 100);
    // boss
    const boss = g.boss && g.boss.alive ? g.boss : null;
    this.set('#bossbar', '.on', !!boss);
    if (boss) {
      this.set('#bossbar .fill', 'w', Math.max(0, (boss.hp / boss.maxHp) * 100).toFixed(1) + '%');
      this.set('#bossbar .name', 'text', { matron: 'The Brood Matron', colossus: 'The Cinder Colossus', herald: 'The Gloam Herald', tyrant: 'The Eclipse Tyrant' }[boss.type]);
    }
    if ((this._invTick = (this._invTick || 0) + 1) % 15 !== 0) return;
    // inventory (only rebuild on change)
    const sig = (g.readyParents || []).join() + '#' + g.weapons.map((w) => w.id + w.level).join() + '|' + Object.entries(g.passives).map(([k, v]) => k + v).join() + '|' + g.pacts.join();
    if (sig !== this.lastInv) {
      this.lastInv = sig;
      const ready = new Set(g.readyParents || []);
      const wi = g.weapons.map((w) => `<div class="slot ${w.fused ? 'fused' : ''} ${w.level >= MAX_WEAPON_LEVEL && !w.fused ? 'max' : ''} ${ready.has(w.id) ? 'ready' : ''}"><img src="${iconURL(w.id)}"><span>${w.fused ? '★' : w.level}</span>${ready.has(w.id) ? '<i class="fuse-badge">⚗</i>' : ''}</div>`).join('');
      const pi = Object.entries(g.passives).map(([k, v]) => `<div class="slot small ${v >= PASSIVES[k].max ? 'max' : ''}"><img src="${iconURL(k)}"><span>${v}</span></div>`).join('');
      const pc = g.pacts.map(() => `<div class="slot small pact"><img src="${iconURL('pact')}"></div>`).join('');
      $('#inv').innerHTML = `<div class="inv-row">${wi}</div><div class="inv-row">${pi}${pc}</div>`;
    }
  }

  toast(text, kind = '') {
    const box = $('#toasts');
    // de-dupe: re-trigger an identical live toast instead of stacking copies
    for (const t of box.children) {
      if (t.textContent === text) { t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; return; }
    }
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
  hintPop(text) {
    document.querySelectorAll('.hint-pop').forEach((el) => el.remove());
    const el = document.createElement('div');
    el.className = 'hint-pop';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5500);
  }
  featPop(f) {
    const el = document.createElement('div');
    el.className = 'feat-pop';
    el.innerHTML = `<div class="fp-k">FEAT UNLOCKED</div><div class="fp-n">${esc(f.name)}</div><div class="fp-d">${esc(f.desc)} · +${f.reward} ✦</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
  kindlePop(mul) {
    const k = $('#kindle');
    k.classList.remove('pop'); void k.offsetWidth; k.classList.add('pop');
    if (mul >= 2) this.toast(`KINDLE x${mul}`, 'kindle');
  }

  // ---------- level up ----------
  showLevelUp(g, pre = null) {
    let choices = pre || g.buildChoices();
    let banishMode = false;
    const render = () => {
      const cards = choices.map((c, i) => `
        <div class="card pick ${c.kind} ${c.isNew ? 'new' : ''}" data-a="choose" data-i="${i}" style="animation-delay:${i * 60}ms">
          <div class="pk-key kbd-only">${i + 1}</div>
          <img src="${iconURL(c.icon)}">
          <div class="pk-body">
            <div class="pk-name">${esc(c.name)} ${c.level ? `<span class="lv">${c.isNew ? 'NEW' : 'LV ' + c.level}${c.max ? ' · MAX' : ''}</span>` : ''}</div>
            <div class="pk-desc">${esc(c.desc)}</div>
            ${c.hint ? `<div class="pk-hint">${esc(c.hint)}</div>` : ''}
          </div>
        </div>`).join('');
      this.open(`
        <div class="panel levelup ${banishMode ? 'banishing' : ''}">
          <div class="lu-title">LEVEL ${g.level - g.pendingLevels}</div>
          <div class="lu-sub">${banishMode ? 'Choose a card to banish for the rest of the run' : 'The Ember answers. Choose a gift.'}</div>
          <div class="picks">${cards}</div>
          <div class="row small">
            <button class="btn ghost" data-a="reroll" ${g.rerolls > 0 ? '' : 'disabled'}>Reroll (${g.rerolls}) <span class="kbd-only">[R]</span></button>
            <button class="btn ghost" data-a="banish" ${g.banishes > 0 ? '' : 'disabled'}>${banishMode ? 'Cancel' : 'Banish'} (${g.banishes}) <span class="kbd-only">[B]</span></button>
            <button class="btn ghost" data-a="skip">Skip (+XP) <span class="kbd-only">[X]</span></button>
          </div>
          ${this.buildSummary(g)}
        </div>`, 'dim');
      const choose = (i) => {
        const c = choices[i];
        if (!c) return;
        if (banishMode) {
          if (c.kind === 'weapon' || c.kind === 'passive') {
            g.banished.add(c.id); g.banishes--; banishMode = false;
            choices.splice(i, 1);
            if (!choices.length) choices = g.buildChoices();
            render();
          }
          return;
        }
        g.applyChoice(c);
        sfx.select();
        this.close();
      };
      this.bind({
        choose: (el) => choose(+el.dataset.i),
        reroll: () => { if (g.rerolls > 0) { g.rerolls--; choices = g.buildChoices(); render(); } },
        banish: () => { if (g.banishes > 0 || banishMode) { banishMode = !banishMode; render(); } },
        skip: () => { g.gainXp(g.xpNext * 0.25); this.close(); },
      });
      // Movement keys (WASD) must never act here, and a short grace stops held keys from auto-picking
      const openedAt = performance.now();
      this.keyHandler = (e) => {
        if (e.repeat || performance.now() - openedAt < 350) return;
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= choices.length) choose(n - 1);
        if (e.code === 'KeyR' && g.rerolls > 0) { g.rerolls--; choices = g.buildChoices(); render(); }
        if (e.code === 'KeyB' && (g.banishes > 0 || banishMode)) { banishMode = !banishMode; render(); }
        if (e.code === 'KeyX') { g.gainXp(g.xpNext * 0.25); this.close(); }
      };
    };
    render();
  }

  buildSummary(g) {
    const s = g.stats;
    const row = (k, v) => `<span><em>${k}</em>${v}</span>`;
    return `<div class="statline">
      ${row('DMG', '+' + Math.round((s.might - 1) * 100) + '%')}${row('CD', '-' + Math.round((1 - s.cooldown) * 100) + '%')}
      ${row('AREA', '+' + Math.round((s.area - 1) * 100) + '%')}${row('AMT', '+' + s.amount)}
      ${row('HP', Math.round(g.player.hp) + '/' + Math.round(s.maxHp))}${row('ARM', s.armor)}
      ${row('CRIT', Math.round(s.crit * 100) + '%')}${row('LUCK', Math.round(s.luck * 100) + '%')}
      ${g.overcharge ? row('OVER', 'x' + g.overcharge) : ''}</div>`;
  }

  // ---------- chest roulette ----------
  showChest(g, res) {
    const n = res.items.length;
    const allIcons = [...Object.keys(WEAPONS), ...Object.keys(PASSIVES)];
    const slots = res.items.map((it, i) => `<div class="reel" data-i="${i}"><div class="reel-inner"><img src="${iconURL(allIcons[i % allIcons.length])}"></div><div class="reel-label"></div></div>`).join('');
    const fusion = res.items.some((x) => x.kind === 'fusion');
    const tier = fusion ? 'ascend' : n >= 5 ? 'gold' : n >= 3 ? 'silver' : 'bronze';
    const tierIdx = { bronze: 0, silver: 1, gold: 2, ascend: 3 }[tier];
    const col = { bronze: '#d89050', silver: '#8ad0ff', gold: '#ffd040', ascend: '#e070ff' }[tier];
    const title = fusion ? 'ASCENSION' : n >= 5 ? 'RADIANT HOARD' : n >= 3 ? 'GILDED CACHE' : 'RELIC CACHE';
    this.open(`
      <div class="panel chest ${fusion ? 'fusion' : ''} tier${n} ct-${tier}" style="--tc:${col}">
        <div class="lu-title chest-title">&nbsp;</div>
        <div class="rays"></div>
        <div class="chest-stage"><div class="chest-aura"></div><img class="chest-big" src="${spriteURL(tier === 'bronze' ? 'chest' : 'chest_' + tier, 4)}" alt=""></div>
        <div class="chest-hint">Something stirs inside…</div>
        <div class="reels hidden">${slots}</div>
        <div class="chest-cinders hidden">+${res.cinders} ✦</div>
        <button class="btn primary hidden" data-a="take">Claim <span class="kbd-only">[Space]</span></button>
        <div class="chest-flash"></div>
      </div>`, 'dim');
    const panel = this.screen.querySelector('.panel');
    const reels = [...this.screen.querySelectorAll('.reel')];
    let done = 0, finished = false, revealed = false;
    const timers = [];
    const buildMs = fusion ? 2700 : n >= 5 ? 2400 : n >= 3 ? 2000 : 1500;
    // phase 1: the chest strains harder and harder, heartbeat quickening
    const t0 = performance.now();
    const pulse = () => {
      if (revealed) return;
      const p = Math.min(1, (performance.now() - t0) / buildMs);
      panel.style.setProperty('--amp', (1 + p * 9).toFixed(2));
      panel.style.setProperty('--glow', (6 + p * 46).toFixed(0) + 'px');
      sfx.chestBuild(p);
      if (p < 1) timers.push(setTimeout(pulse, 420 - 300 * p));
    };
    pulse();
    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
      sfx.chestOpen();
      this.screen.querySelector('[data-a="take"]').classList.remove('hidden');
    };
    // phase 2: the lid bursts, then the reels spin and reveal one by one
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
      timers.length = 0;
      panel.classList.add('opened');
      panel.querySelector('.chest-title').textContent = title;
      panel.querySelector('.chest-hint').remove();
      this.screen.querySelectorAll('.reels, .chest-cinders').forEach((el) => el.classList.remove('hidden'));
      sfx.chestBurst(tierIdx);
      reels.forEach((r, i) => {
        const img = r.querySelector('img');
        let k = 0;
        const spin = setInterval(() => { img.src = iconURL(allIcons[(Math.random() * allIcons.length) | 0]); sfx.chestDrum(k++); }, 70);
        timers.push(spin);
        timers.push(setTimeout(() => {
          clearInterval(spin);
          const it = res.items[i];
          img.src = iconURL(it.icon);
          r.classList.add('done', it.kind);
          r.querySelector('.reel-label').innerHTML = `<b>${esc(it.name)}</b>${it.level ? ` <span>${it.kind === 'fusion' ? '' : 'LV ' + it.level}</span>` : ''}`;
          sfx.pickup();
          if (++done === n) finish();
        }, 700 + i * 380 + (it_isFusion(res.items[i]) ? 600 : 0)));
      });
    };
    timers.push(setTimeout(reveal, buildMs));
    const take = () => {
      if (!revealed) { reveal(); return; } // first press skips the build-up
      if (!finished) {
        // second press skips the reel animation
        reels.forEach((r, i) => {
          const it = res.items[i];
          r.querySelector('img').src = iconURL(it.icon);
          r.classList.add('done', it.kind);
          r.querySelector('.reel-label').innerHTML = `<b>${esc(it.name)}</b>`;
        });
        finish();
        return;
      }
      this.close();
      g.applyChest(res);
    };
    this.bind({ take });
    const chestAt = performance.now();
    this.keyHandler = (e) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && performance.now() - chestAt > 350) { e.preventDefault(); take(); } };
    // tapping anywhere on the panel before the reveal also skips ahead
    panel.addEventListener('pointerdown', () => { if (!revealed && performance.now() - chestAt > 350) reveal(); });
  }

  // ---------- pause ----------
  showPause(g) {
    sfx.pause(); duck(true);
    const rows = g.weapons.map((w) => {
      const name = w.fused ? FUSIONS[w.id].name : WEAPONS[w.id].name;
      return `<tr><td><img src="${iconURL(w.id)}"></td><td>${name}</td><td>${w.fused ? '★' : 'LV ' + w.level}</td><td>${fmtNum(w.dmgDone)}</td><td>${fmtNum(w.dmgDone / Math.max(1, g.time))}/s</td></tr>`;
    }).join('');
    this.open(`
      <div class="panel">
        <h2>Paused</h2>
        <div class="run-ctx">
          <span style="color:${STAGES[g.stageId].color}">${STAGES[g.stageId].name}</span>
          ${g.heat ? `<span class="heat-tag">Heat ${g.heat}</span>` : ''}
          ${g.daily ? `<span class="daily-tag">Daily ${g.daily.key}</span>` : ''}
          ${g.pacts.map((p) => `<span class="pactname" title="${esc(PACTS[p].desc)}">${PACTS[p].name}</span>`).join('')}
          ${g.overcharge ? `<span class="oc-tag">Overcharge ×${g.overcharge}</span>` : ''}
        </div>
        <table class="dmg"><tr><th></th><th>Weapon</th><th></th><th>Damage</th><th>DPS</th></tr>${rows}</table>
        ${this.buildSummary(g)}
        <div class="row">
          <button class="btn primary" data-a="resume">Resume</button>
          <button class="btn" data-a="settings">Settings</button>
          <button class="btn ghost danger" data-a="quit">Abandon run</button>
        </div>
      </div>`, 'dim');
    this.bind({
      resume: () => this.close(),
      settings: () => this.showSettings(true),
      quit: () => { this.close(); this.showResults(g, false, true); },
    });
    this.keyHandler = (e) => { if (e.code === 'Escape' || e.code === 'KeyP') this.close(); };
  }

  showVictory(g) {
    sfx.victory();
    this.open(`
      <div class="panel results win">
        <div class="lu-title">THE ECLIPSE BREAKS</div>
        <div class="sub">The Tyrant falls and a sliver of dawn bleeds through the Gloam.<br>But the Hollow has noticed you. In two minutes it will come, and nothing you own can harm it.<br>Bank your victory, or see how long you can run.</div>
        <div class="row">
          <button class="btn primary" data-a="endless">Keep Burning (Endless)</button>
          <button class="btn" data-a="end">Rest at the Hearth</button>
        </div>
      </div>`, 'dim');
    this.bind({
      endless: () => { g.endless = true; this.close(); },
      end: () => { this.close(); this.showResults(g, true); },
    });
  }

  showResults(g, win, abandoned = false) {
    if (g.resultsShown) return;
    g.resultsShown = true;
    const { bonus, total: base } = g.runReward(win);
    // one-off milestone bonuses the first time you outlast each mark on this stage
    const claimed = save.milestones[g.stageId] || 0;
    let milestoneGain = 0, milestoneCount = 0;
    if (!g.daily) {
      for (let i = claimed; i < MILESTONES.length; i++) {
        if (g.time < MILESTONES[i].t) break;
        milestoneGain += Math.round(MILESTONES[i].reward * STAGES[g.stageId].greedMul); milestoneCount++;
      }
      if (milestoneCount) save.milestones[g.stageId] = claimed + milestoneCount;
    }
    // Seals: lasting marks of mastery, earned on wins (never on the Daily Ember)
    const sealsEarned = [];
    let sealGain = 0;
    if (win && !g.daily) {
      const SG = save.seals[g.stageId] || (save.seals[g.stageId] = {});
      const grant = (id) => {
        if (SG[id]) return;
        SG[id] = 1; sealsEarned.push(id);
        sealGain += Math.round(SEALS[id].cinders * Math.sqrt(STAGES[g.stageId].greedMul));
      };
      grant('dawn');
      if (g.obj.done && g.obj.doneAt <= 720) grant('swift');
      if ((g.heat || 0) >= 3) grant('ember');
      if (g.diff.name === 'Hard' || g.diff.name === 'Brutal') grant('iron');
      const wb = save.stageBearers[g.stageId] || (save.stageBearers[g.stageId] = []);
      if (!wb.includes(g.charId)) wb.push(g.charId);
      if (wb.length >= 3) grant('fellow');
    }
    const total = base + milestoneGain + sealGain;
    save.cinders += total;
    let dailyBonus = 0;
    if (g.daily) {
      const prev = save.daily[g.daily.key];
      if (!prev) dailyBonus = 100;
      save.daily[g.daily.key] = { time: Math.max(prev ? prev.time : 0, g.time), kills: Math.max(prev ? prev.kills : 0, g.kills) };
      save.cinders += dailyBonus;
    }
    save.totals.runs++; save.totals.kills += g.kills; save.totals.cinders += total;
    Object.assign(save.seen, g.seenRun);
    // records: per-stage and per-Bearer bests
    const R = save.records;
    const st = R['stage:' + g.stageId] || (R['stage:' + g.stageId] = { time: 0, heatWon: -1, wins: 0 });
    st.time = Math.max(st.time, g.time);
    if (win) { st.wins++; st.heatWon = Math.max(st.heatWon, g.heat || 0); }
    const ch = R['char:' + g.charId] || (R['char:' + g.charId] = { runs: 0, wins: 0, time: 0 });
    ch.runs++; ch.time = Math.max(ch.time, g.time); if (win) ch.wins++;
    if (win) save.totals.wins++;
    let heatUnlocked = 0;
    if (win && g.heat < HEAT_MAX && (save.heatMax[g.stageId] || 0) <= g.heat) {
      save.heatMax[g.stageId] = g.heat + 1; save.heatSel[g.stageId] = g.heat + 1; heatUnlocked = g.heat + 1;
    }
    const newBest = g.time > save.best.time;
    save.best.time = Math.max(save.best.time, g.time);
    save.best.kills = Math.max(save.best.kills, g.kills);
    save.best.level = Math.max(save.best.level, g.level);
    persist();
    const rows = g.weapons.slice().sort((a, b) => b.dmgDone - a.dmgDone).map((w) => {
      const name = w.fused ? FUSIONS[w.id].name : WEAPONS[w.id].name;
      return `<tr><td><img src="${iconURL(w.id)}"></td><td>${name}</td><td>${w.fused ? '★' : 'LV ' + w.level}</td><td>${fmtNum(w.dmgDone)}</td><td>${fmtNum(w.kills)}</td></tr>`;
    }).join('');
    // what can we afford now? (the hook for "one more run")
    const affordable = Object.entries(META).filter(([id, m]) => (save.meta[id] || 0) < m.max && save.cinders >= Math.round(m.cost * (1 + (save.meta[id] || 0) * 0.6))).length;
    const nextChar = Object.entries(CHARACTERS).find(([id]) => !save.unlocked[id]);
    this.open(`
      <div class="panel results ${win ? 'win' : ''}">
        <div class="lu-title">${win ? 'DAWN, FOR NOW' : abandoned ? 'THE EMBER DIMS' : 'SWALLOWED BY THE GLOAM'}</div>
        ${newBest ? '<div class="newbest">NEW BEST TIME</div>' : ''}
        ${heatUnlocked ? `<div class="newbest">HEAT ${heatUnlocked} UNLOCKED</div>` : ''}
        ${sealsEarned.length ? `<div class="seals-earned">${sealsEarned.map((id) => `<span><img src="${iconURL(SEALS[id].icon)}" alt="">${SEALS[id].name}${id === 'dawn' && KEEPSAKES[g.stageId] ? ` · Keepsake: ${KEEPSAKES[g.stageId].name}` : ''}</span>`).join('')}</div>` : ''}
        ${!win && !abandoned && g.lastHitBy ? `<div class="death-recap">Felled by <b>${esc(srcName(g.lastHitBy))}</b>${g.dmgLog ? ` · most damage from ${Object.entries(g.dmgLog).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${esc(srcName(k))} (${Math.round(v)})`).join(', ')}` : ''}</div>` : ''}
        ${g.daily ? `<div class="sub">Daily Ember ${g.daily.key}${dailyBonus ? ` · first run bonus <b>+${dailyBonus} ✦</b>` : ''}</div>` : ''}
        ${g.heat ? `<div class="sub">${STAGES[g.stageId].name} · Heat ${g.heat}</div>` : ''}
        <div class="res-grid">
          <div><em>Survived</em><b>${fmtTime(g.time)}</b></div>
          <div><em>Level</em><b>${g.level}</b></div>
          <div><em>Slain</em><b>${fmtNum(g.kills)}</b></div>
          <div><em>Best streak</em><b>${fmtNum(g.bestCombo)}</b></div>
        </div>
        <table class="dmg"><tr><th></th><th>Weapon</th><th></th><th>Damage</th><th>Kills</th></tr>${rows}</table>
        ${g.featsEarned.length ? `<div class="run-feats">${g.featsEarned.map((id) => `<span>★ ${FEATS[id].name} +${FEATS[id].reward}</span>`).join('')}</div>` : ''}
        <div class="earned">+${g.cinders} gathered · +${bonus} survival bonus${milestoneGain ? ` · +${milestoneGain} milestone` : ''}${sealGain ? ` · +${sealGain} seals` : ''} = <b>${total} ✦</b>${g.diff && g.diff.cinders !== 1 ? ` <small>(${g.diff.name}: x${g.diff.cinders} cinders, x${g.diff.xp} XP)</small>` : ''}</div>
        <div class="hook">${affordable ? `${affordable} Hearth upgrade${affordable > 1 ? 's' : ''} affordable!` : nextChar ? `${nextChar[1].cost - save.cinders > 0 ? nextChar[1].cost - save.cinders + ' ✦ until ' + nextChar[1].name + ' unlocks' : nextChar[1].name + ' can be unlocked!'}` : ''}</div>
        <div class="row">
          <button class="btn primary" data-a="again">Again [Enter]</button>
          <button class="btn" data-a="share">Share</button>
          <button class="btn" data-a="hearth">The Hearth</button>
          <button class="btn ghost" data-a="title">Title</button>
        </div>
      </div>`, 'dim');
    const charId = g.charId;
    this.bind({
      share: (el) => {
        const c = CHARACTERS[g.charId], stage = STAGES[g.stageId];
        const fused = g.weapons.filter((w) => w.fused).map((w) => FUSIONS[w.id].name);
        const text = `Emberwake 🔥 ${c.name}, ${c.title} ${win ? 'broke the Eclipse' : 'survived'} ${fmtTime(g.time)} on ${stage.name}`
          + (g.heat ? ` (Heat ${g.heat})` : '') + (g.daily ? ` · Daily ${g.daily.key}` : '')
          + ` · LV ${g.level} · ${fmtNum(g.kills)} slain` + (fused.length ? ` · Ascended: ${fused.join(', ')}` : '')
          + (!win && !abandoned && g.lastHitBy ? ` · felled by ${srcName(g.lastHitBy)}` : '');
        const done = () => { el.textContent = 'Copied!'; setTimeout(() => (el.textContent = 'Share'), 1600); };
        // eslint-disable-next-line no-alert -- fallback lets the player copy manually when clipboard is unavailable
        const manual = () => prompt('Copy your run:', text);
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, manual);
        else manual();
      },
      again: () => { this.close(); g.daily ? this.h.startRun(g.daily.charId, g.daily.stageId, { daily: g.daily }) : this.h.startRun(charId); },
      hearth: () => { this.h.quitToTitle(); this.showHearth(); },
      title: () => { this.h.quitToTitle(); this.showTitle(); },
    });
    this.keyHandler = (e) => { if (e.code === 'Enter') { this.close(); this.h.startRun(charId); } };
  }
}

// The current objective, shown under the timer so a run always has a clear next goal
function goalText(g) {
  const t = g.time;
  if (g.hollowN > 0) return `SURVIVE THE HOLLOW · ${g.hollowN} hunting`;
  const hl = Math.max(0, g.hollowAt - t);
  if (g.victory) return `The Hollow comes in ${fmtTime(hl)}: flee or keep burning`;
  if (g.boss && g.boss.type === 'tyrant') return g.obj.done ? 'GOAL · Break the Eclipse Tyrant' : 'THE TYRANT IS WARDED · finish the objective first';
  if (t >= 900) return g.obj.done ? `GOAL · Slay the Tyrant before the Hollow (${fmtTime(hl)})` : `OBJECTIVE FIRST: the Tyrant is warded (${fmtTime(hl)} to the Hollow)`;
  return g.obj.done ? `THEN · Break the Eclipse ${fmtTime(900 - t)}` : `GOAL · Complete the objective, then break the Eclipse ${fmtTime(900 - t)}`;
}
function it_isFusion(it) { return it && it.kind === 'fusion'; }

// readable names for damage sources recorded by Game.hurtPlayer
function srcName(src) {
  const [kind, raw = ''] = src.split(':');
  const elite = raw.endsWith('*'), id = raw.replace('*', '');
  const name = (BESTIARY[id] && BESTIARY[id].name) || id;
  if (kind === 'touch') return (elite ? 'an elite ' : '') + name;
  if (kind === 'shot') return id ? `${name}'s orbs` : 'Spitter venom';
  return { settle: 'standing still: the Gloam settled on you', slam: "the Colossus's slam", 'imp-ember': 'Cinder Imp embers', volatile: 'a volatile elite\'s embers' }[kind] || kind;
}
