const KEY = 'emberwake_save_v1';

const DEFAULT = {
  cinders: 0,
  meta: {},
  unlocked: { warden: true },
  fusions: {},
  feats: {},
  stages: { gloam: true },
  heatMax: {},
  seen: {},
  daily: {},
  hints: {},
  records: {},
  skins: {},
  heatSel: {},
  lastStage: 'gloam',
  best: { time: 0, kills: 0, level: 0 },
  totals: { runs: 0, kills: 0, cinders: 0, wins: 0 },
  settings: { muted: false, music: true, numbers: true, shake: true, lowfx: false, volume: 100, musicVolume: 100 },
};

export const save = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...structuredClone(DEFAULT), ...s, feats: s.feats || {}, stages: { gloam: true, ...(s.stages || {}) }, heatMax: s.heatMax || {}, seen: s.seen || {}, daily: s.daily || {}, hints: s.hints || {}, records: s.records || {}, skins: s.skins || {}, heatSel: s.heatSel || {}, settings: { ...DEFAULT.settings, ...(s.settings || {}) } };
    }
  } catch { /* storage unavailable */ }
  return structuredClone(DEFAULT);
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function resetSave() {
  const s = structuredClone(DEFAULT);
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, s);
  persist();
}
