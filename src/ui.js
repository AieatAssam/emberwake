// HTML overlay UI: menus, HUD, level-up drafts, chest reveals.
import { iconURL, spriteURL } from './atlas.js';
import { CHARACTERS, WEAPONS, PASSIVES, FUSIONS, META, FEATS, STAGES, MAX_WEAPON_LEVEL } from './data.js';
import { KINDLE_TIERS } from './game.js';
import { save, persist, resetSave } from './save.js';
import { sfx, initAudio, setMuted, setMusic } from './audio.js';
import { clearPressed } from './input.js';

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
    $('#pausebtn').addEventListener('click', () => this.game && !this.modalOpen && this.showPause(this.game));
    $('#flarebtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); this.game && this.game.triggerFlare(); });
  }

  open(html, cls = '') {
    this.screen.className = 'show ' + cls;
    this.screen.innerHTML = html;
    this.modalOpen = true;
    if (this.game) this.game.paused = true;
    this.screen.querySelectorAll('button, .card').forEach((b) => b.addEventListener('pointerenter', () => sfx.hover()));
  }
  close() {
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
        <div class="menu">
          <button class="btn primary" data-a="play">Kindle a Run</button>
          <button class="btn" data-a="hearth">The Hearth <small>${s.cinders} ✦</small></button>
          <button class="btn" data-a="codex">Codex</button>
          <button class="btn" data-a="settings">Settings</button>
        </div>
        <div class="stats-line">Best ${fmtTime(s.best.time)} · ${s.totals.runs} runs · ${fmtNum(s.totals.kills)} slain · ${s.totals.wins} victories</div>
        <div class="howto">WASD / Arrows to move · weapons fire on their own · <b>SPACE</b> to unleash your Flare · ESC pause</div>
      </div>`, 'title');
    this.bind({
      play: () => this.showCharSelect(),
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
          ${un ? `<div class="cw"><img src="${iconURL(c.weapon)}">${WEAPONS[c.weapon].name}</div>` : `<div class="cost">${c.cost} ✦</div>`}
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
          </div>
          <h3 class="stage-h">Stage</h3>
          <div class="stage-grid">${Object.entries(STAGES).map(([id, st]) => {
            const open = save.stages[id];
            const cur = (save.lastStage || 'gloam') === id;
            return `<div class="card stage ${open ? '' : 'locked'} ${cur ? 'sel' : ''}" data-a="stage" data-id="${id}" style="--c:${st.color}">
              <div class="stage-swatch" style="background:${st.ground.base}"><i style="background:${st.ground.blobs[0]}"></i><i style="background:${st.ground.blobs[2]}"></i></div>
              <div><div class="cname">${st.name}</div><div class="mdesc">${st.desc}</div>
              ${open ? '' : `<div class="cost">${st.cost} ✦ ${save.cinders >= st.cost ? '· click to unlock' : ''}</div>`}</div></div>`;
          }).join('')}</div>
          ${(() => {
            const st = save.lastStage || 'gloam', mx = save.heatMax[st] || 0, cur = Math.min(save.heatSel[st] || 0, mx);
            if (!mx) return `<div class="heat-row muted">Win on this stage to unlock <b>Heat</b> — harder runs for richer cinders.</div>`;
            return `<div class="heat-row"><span>Heat</span>${Array.from({ length: mx + 1 }, (_, i) => `<button class="heat-btn ${i === cur ? 'on' : ''}" data-a="heat" data-h="${i}">${i}</button>`).join('')}
              <em>${cur ? `+${cur * 25}% enemy health · +${cur * 10}% spawns · +${cur * 30}% cinders` : 'Standard difficulty'}</em></div>`;
          })()}
          <div class="row">
            <button class="btn" data-a="back">Back</button>
            ${un ? `<button class="btn primary" data-a="go">Begin</button>`
              : `<button class="btn primary" data-a="buy" ${save.cinders < c.cost ? 'disabled' : ''}>Unlock · ${c.cost} ✦</button>`}
          </div>
          <div class="wallet">${save.cinders} ✦ cinders</div>
        </div>`);
      this.bind({
        pick: (el) => { sel = el.dataset.id; render(); },
        heat: (el) => { save.heatSel[save.lastStage || 'gloam'] = +el.dataset.h; persist(); render(); },
        stage: (el) => {
          const id = el.dataset.id, st = STAGES[id];
          if (!save.stages[id]) {
            if (save.cinders < st.cost) return;
            save.cinders -= st.cost; save.stages[id] = true; sfx.chestOpen();
          }
          save.lastStage = id; persist(); render();
        },
        back: () => this.showTitle(),
        go: () => { this.close(); this.h.startRun(sel); },
        buy: () => {
          if (save.cinders >= c.cost) { save.cinders -= c.cost; save.unlocked[sel] = true; persist(); sfx.chestOpen(); render(); }
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
          <div class="row"><button class="btn" data-a="back">Back</button><button class="btn ghost" data-a="refund">Refund all</button></div>
          <div class="wallet">${save.cinders} ✦ cinders</div>
        </div>`);
      this.bind({
        back: () => this.showTitle(),
        buy: (el) => {
          const id = el.dataset.id, m = META[id], l = save.meta[id] || 0;
          const cost = Math.round(m.cost * (1 + l * 0.6));
          if (l < m.max && save.cinders >= cost) { save.cinders -= cost; save.meta[id] = l + 1; persist(); sfx.levelup(); render(); }
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
        ${t('muted', 'Mute all audio')}${t('music', 'Music')}${t('numbers', 'Damage numbers')}${t('shake', 'Screen shake')}
        <div class="row"><button class="btn" data-a="back">Back</button>${fromPause ? '' : '<button class="btn ghost danger" data-a="wipe">Erase save</button>'}</div>
      </div>`);
    this.screen.querySelectorAll('input[data-k]').forEach((el) => el.addEventListener('change', () => {
      st[el.dataset.k] = el.checked; persist();
      setMuted(st.muted); setMusic(st.music);
    }));
    this.bind({
      back: () => (fromPause ? this.showPause(this.game) : this.showTitle()),
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
      this.set('#bossbar .name', 'text', { matron: 'The Brood Matron', colossus: 'The Cinder Colossus', tyrant: 'The Eclipse Tyrant' }[boss.type]);
    }
    if ((this._invTick = (this._invTick || 0) + 1) % 15 !== 0) return;
    // inventory (only rebuild on change)
    const sig = g.weapons.map((w) => w.id + w.level).join() + '|' + Object.entries(g.passives).map(([k, v]) => k + v).join() + '|' + g.pacts.join();
    if (sig !== this.lastInv) {
      this.lastInv = sig;
      const wi = g.weapons.map((w) => `<div class="slot ${w.fused ? 'fused' : ''} ${w.level >= MAX_WEAPON_LEVEL && !w.fused ? 'max' : ''}"><img src="${iconURL(w.id)}"><span>${w.fused ? '★' : w.level}</span></div>`).join('');
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
          <div class="pk-key">${i + 1}</div>
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
            <button class="btn ghost" data-a="reroll" ${g.rerolls > 0 ? '' : 'disabled'}>Reroll (${g.rerolls}) [R]</button>
            <button class="btn ghost" data-a="banish" ${g.banishes > 0 ? '' : 'disabled'}>${banishMode ? 'Cancel' : 'Banish'} (${g.banishes}) [B]</button>
            <button class="btn ghost" data-a="skip">Skip (+XP) [S]</button>
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
      this.keyHandler = (e) => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= choices.length) choose(n - 1);
        if (e.code === 'KeyR' && g.rerolls > 0) { g.rerolls--; choices = g.buildChoices(); render(); }
        if (e.code === 'KeyB' && (g.banishes > 0 || banishMode)) { banishMode = !banishMode; render(); }
        if (e.code === 'KeyS') { g.gainXp(g.xpNext * 0.25); this.close(); }
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
    this.open(`
      <div class="panel chest ${fusion ? 'fusion' : ''} tier${n}">
        <div class="lu-title">${fusion ? 'ASCENSION' : n >= 5 ? 'RADIANT HOARD' : n >= 3 ? 'GILDED CACHE' : 'RELIC CACHE'}</div>
        <div class="rays"></div>
        <div class="reels">${slots}</div>
        <div class="chest-cinders">+${res.cinders} ✦</div>
        <button class="btn primary hidden" data-a="take">Claim [Space]</button>
      </div>`, 'dim');
    const reels = [...this.screen.querySelectorAll('.reel')];
    let done = 0, finished = false;
    const timers = [];
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
    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
      sfx.chestOpen();
      this.screen.querySelector('[data-a="take"]').classList.remove('hidden');
    };
    const take = () => {
      if (!finished) {
        // skip animation
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
    this.keyHandler = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); take(); } };
  }

  // ---------- pause ----------
  showPause(g) {
    const rows = g.weapons.map((w) => {
      const name = w.fused ? FUSIONS[w.id].name : WEAPONS[w.id].name;
      return `<tr><td><img src="${iconURL(w.id)}"></td><td>${name}</td><td>${w.fused ? '★' : 'LV ' + w.level}</td><td>${fmtNum(w.dmgDone)}</td><td>${fmtNum(w.dmgDone / Math.max(1, g.time))}/s</td></tr>`;
    }).join('');
    this.open(`
      <div class="panel">
        <h2>Paused</h2>
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
        <div class="sub">The Tyrant falls and a sliver of dawn bleeds through the Gloam.<br>But the dark is endless — and so is your flame.</div>
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
    const bonus = Math.round((Math.floor(g.time / 60) * 6 + g.kills / 80) * g.stats.greed) + (win ? 300 : 0);
    const total = g.cinders + bonus;
    save.cinders += total;
    save.totals.runs++; save.totals.kills += g.kills; save.totals.cinders += total;
    if (win) save.totals.wins++;
    let heatUnlocked = 0;
    if (win && g.heat < 5 && (save.heatMax[g.stageId] || 0) <= g.heat) {
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
    const nextChar = Object.entries(CHARACTERS).find(([id, c]) => !save.unlocked[id]);
    this.open(`
      <div class="panel results ${win ? 'win' : ''}">
        <div class="lu-title">${win ? 'DAWN, FOR NOW' : abandoned ? 'THE EMBER DIMS' : 'SWALLOWED BY THE GLOAM'}</div>
        ${newBest ? '<div class="newbest">NEW BEST TIME</div>' : ''}
        ${heatUnlocked ? `<div class="newbest">HEAT ${heatUnlocked} UNLOCKED</div>` : ''}
        ${g.heat ? `<div class="sub">${STAGES[g.stageId].name} · Heat ${g.heat}</div>` : ''}
        <div class="res-grid">
          <div><em>Survived</em><b>${fmtTime(g.time)}</b></div>
          <div><em>Level</em><b>${g.level}</b></div>
          <div><em>Slain</em><b>${fmtNum(g.kills)}</b></div>
          <div><em>Best streak</em><b>${fmtNum(g.bestCombo)}</b></div>
        </div>
        <table class="dmg"><tr><th></th><th>Weapon</th><th></th><th>Damage</th><th>Kills</th></tr>${rows}</table>
        ${g.featsEarned.length ? `<div class="run-feats">${g.featsEarned.map((id) => `<span>★ ${FEATS[id].name} +${FEATS[id].reward}</span>`).join('')}</div>` : ''}
        <div class="earned">+${g.cinders} gathered · +${bonus} survival bonus = <b>${total} ✦</b></div>
        <div class="hook">${affordable ? `${affordable} Hearth upgrade${affordable > 1 ? 's' : ''} affordable!` : nextChar ? `${nextChar[1].cost - save.cinders > 0 ? nextChar[1].cost - save.cinders + ' ✦ until ' + nextChar[1].name + ' unlocks' : nextChar[1].name + ' can be unlocked!'}` : ''}</div>
        <div class="row">
          <button class="btn primary" data-a="again">Again [Enter]</button>
          <button class="btn" data-a="hearth">The Hearth</button>
          <button class="btn ghost" data-a="title">Title</button>
        </div>
      </div>`, 'dim');
    const charId = g.charId;
    this.bind({
      again: () => { this.close(); this.h.startRun(charId); },
      hearth: () => { this.h.quitToTitle(); this.showHearth(); },
      title: () => { this.h.quitToTitle(); this.showTitle(); },
    });
    this.keyHandler = (e) => { if (e.code === 'Enter') { this.close(); this.h.startRun(charId); } };
  }
}

function it_isFusion(it) { return it && it.kind === 'fusion'; }
