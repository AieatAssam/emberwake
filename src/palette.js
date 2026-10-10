// Emberwake locked palette, v1 (72 swatches). Art source of truth: docs/art/style-guide.md
// and docs/art/palette.md. Drawing code and CSS variables name these swatches; they do not
// inline hex. Numeric PAL values are Pixi tints (0xRRGGBB). HEX strings are Canvas2D fills.

export const SHARED = Object.freeze({
  INK: 0x0b0614, // Ink: outline for every sprite, canvas bg, pupils
  SLATE_D: 0x2a2836, // Slate Shadow: stone/metal shadow side
  SLATE: 0x4a4660, // Slate: stone, iron, cloth base
  SLATE_L: 0x7a7490, // Slate Light: stone/metal lit side
  SLATE_H: 0xb8b4c8, // Slate Highlight: metal glints, steel; UI muted text
  BONE: 0xe8dcc4, // Bone: bone, parchment, candle wax
  WHITE: 0xffffff, // White: specular dots, eye whites, glow cores
  FROST_D: 0x1e5a86, // Frost Deep: ice outline/shadow
  FROST: 0x6cc8f0, // Frost: ice, blades, storm
  FROST_L: 0xbfeaff, // Frost Light: ice lit faces, snow
  FROST_H: 0xeaf9ff, // Frost Highlight: ice glints, lightning core
  WOOD: 0x5a4630, // Wood: banner poles, signposts, wreck, bearer leather
  WOOD_L: 0x9a7a4a, // Wood Light: planks lit, brass, rope
});

export const GROUND = Object.freeze({
  G_NIGHT: 0x141a24, // Night Ground: Gloam, Rimewood, Stormbreak Coast
  G_ASH: 0x1e1410, // Ashfields Ground
  G_MARSH: 0x0e1612, // Marsh Ground
  G_RELIQ: 0x17121e, // Reliquary Ground
  G_DUNES: 0x241a12, // Dunes Ground
  G_ROAD: 0x252a2c, // Old Road Ground
});

export const PLAYER = Object.freeze({
  EMBER_D: 0xb8601a, // Ember Deep: player ember shadow, scarf shade
  EMBER: 0xffa030, // Ember: scarf, lantern, bolts, Kindle, UI --ember
  EMBER_L: 0xffc860, // Ember Light: flame body, lantern glass, UI --ember2
  EMBER_H: 0xfff1c0, // Ember Core: flame core, holy light
  SKIN: 0xf2c8a0, // Skin: Bearer faces/hands
  SKIN_D: 0xb07a5a, // Skin Shade: Bearer face shade, leather
  CRIMSON: 0x9a2038, // Bearer Crimson: friendly red, darker than the hostile signal
  MOON: 0xb9a8ff, // Moonsilver: cool Bearer accents, glaive
});

export const HOSTILE = Object.freeze({
  HFIRE_D: 0x6a1408, // Hostile Fire Deep
  HFIRE_B: 0xc42a10, // Hostile Fire Base
  HFIRE: 0xff4a2a, // Hostile Fire: cracks, vents, volatile halo, telegraphs
  HFIRE_H: 0xffa08c, // Hostile Fire Core
  HEYE: 0xff3a6a, // Hostile Signal: enemy eyes, boss halo, boss bar
  HGLARE: 0xe8ff4a, // Hostile Glare: yellow enemy eyes, tyrant crown jewels
  HEYE_D: 0x5a0f1c, // Hostile Signal Deep: pupils, boss bar dark
  GLOOM_D: 0x62509a,
  GLOOM: 0x8a62c8,
  GLOOM_L: 0xb48ae8,
  SHROUD_D: 0x5a5080,
  SHROUD: 0x9488b8,
  HULK_D: 0x5a4a48,
  HULK: 0x86706a,
  HULK_L: 0xa8948a,
  ROSE_D: 0x5a2846,
  ROSE: 0xa8506a,
  ROSE_L: 0xff9ad0, // vampiric halo
  BOG_D: 0x3e6a2a,
  BOG: 0x7aa848,
  BOG_L: 0xc6f07a,
  SPIRIT_D: 0x14524a,
  SPIRIT: 0x4ab8a0,
  SPIRIT_L: 0xb0f4e4,
  RIM: 0xe6dcff, // Enemy Rim, drawn outside the ink outline at alpha 0.5
});

export const REWARD = Object.freeze({
  R_BLUE: 0x46aaff,
  R_GREEN: 0x3cdc6e,
  R_PINK: 0xff6ad8, // gem tier 2 (moved off red), heart, flare orb
  R_VIOLET: 0xbe5aff,
  R_GOLD: 0xffd84a,
  R_BRONZE: 0xc8803c,
  R_GOLD_D: 0x7a4a08,
  R_LIGHT: 0xfff6dc,
});

export const OBJECTIVE = Object.freeze({
  OBJ: 0x8af0e4,
  OBJ_D: 0x3aa892,
});

export const SCENERY = Object.freeze({
  MOSS_D: 0x1e3a32,
  MOSS: 0x2f5a4a,
  MOSS_L: 0x5a8a6a,
  WOOD_D: 0x2a1c16,
  SAND: 0xc8a878,
});

export const UI = Object.freeze({
  PANEL: 0x120c1e,
  TEXT: 0xf3e9dc,
  PACT: 0x8a2ad0, // Dark Pact, moved off red
});

export const FX = Object.freeze({
  HURT: 0xff0020, // player hurt vignette only
  VOID: 0xc080ff, // vortex, gravewell, warded halo
});

export const PAL = Object.freeze({
  ...SHARED, ...GROUND, ...PLAYER, ...HOSTILE, ...REWARD, ...OBJECTIVE, ...SCENERY, ...UI, ...FX,
});

export const HEX = Object.freeze(Object.fromEntries(
  Object.entries(PAL).map(([k, v]) => [k, '#' + v.toString(16).padStart(6, '0')]),
));

export const RAMP = Object.freeze({
  ember: ['EMBER_D', 'EMBER', 'EMBER_L', 'EMBER_H'],
  hostileFire: ['HFIRE_D', 'HFIRE_B', 'HFIRE', 'HFIRE_H'],
  gloom: ['GLOOM_D', 'GLOOM', 'GLOOM_L'],
  shroud: ['SHROUD_D', 'SHROUD'],
  hulk: ['HULK_D', 'HULK', 'HULK_L'],
  rose: ['ROSE_D', 'ROSE', 'ROSE_L'],
  bog: ['BOG_D', 'BOG', 'BOG_L'],
  spirit: ['SPIRIT_D', 'SPIRIT', 'SPIRIT_L'],
  frost: ['FROST_D', 'FROST', 'FROST_L', 'FROST_H'],
  stone: ['SLATE_D', 'SLATE', 'SLATE_L', 'SLATE_H'],
  moss: ['MOSS_D', 'MOSS', 'MOSS_L'],
  wood: ['WOOD_D', 'WOOD', 'WOOD_L'],
});

export const GEM_TIERS = Object.freeze(['R_BLUE', 'R_GREEN', 'R_PINK', 'R_VIOLET', 'R_GOLD']);
export const CHEST = Object.freeze({ bronze: 'R_BRONZE', silver: 'FROST', gold: 'R_GOLD', ascend: 'R_VIOLET' });

// Lighter elite multiply (was 0xffe0a0).
export const ELITE_TINT = 0xfff0d0;
export const BOSS_HALO = PAL.HEYE;
export const ELITE_HALO = PAL.RIM;
export const AFFIX_TINT = Object.freeze({
  swift: PAL.FROST,
  vampiric: PAL.ROSE_L,
  warded: PAL.VOID,
  volatile: PAL.HFIRE,
});

// Widths are recorded for the style guide. This pass does not change outline widths.
export const OUTLINE = Object.freeze({
  color: PAL.INK, silhouette: 2.5, small: 1.5, boss: 4.0, detailMin: 1.2, detailMax: 1.6,
});
// 1 logical px outside the ink outline, hostile sprites only.
export const RIM = Object.freeze({ color: PAL.RIM, alpha: 0.5, width: 1 });

// One prop rule. Replaces the three dimFrame presets and per-stage decorTint.
export const PROP_RULE = Object.freeze({
  targetLuminance: 0.047, desaturate: 0.15, alpha: 0.8, decorTint: 0xffffff,
});

// Grounded contact shadow, and the smaller shadow under floating enemies.
export const SHADOW = Object.freeze({ alpha: 0.45, floatAlpha: 0.3, floatWidth: 0.7 });

export const CONTRAST = Object.freeze({
  enemyBody: 3.0, pickup: 4.5, objective: 4.5, propMin: 1.4, propMax: 2.0,
});

// Canvas2D colour with alpha. `color` is a HEX string or a PAL number.
export function rgba(color, a) {
  const hex = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function palVar(id) {
  return '--pal-' + id.toLowerCase().replaceAll('_', '-');
}

// Inject --pal-* (and the legacy aliases style.css reads) before the stylesheet applies.
export function installPalette() {
  if (typeof document === 'undefined' || document.documentElement.dataset.palette) return;
  document.documentElement.dataset.palette = 'v1';
  const lines = Object.keys(PAL).map((k) => `${palVar(k)}:${HEX[k]}`);
  const alias = [
    '--ember:var(--pal-ember)',
    '--ember2:var(--pal-ember-l)',
    '--ink:var(--pal-ink)',
    '--text:var(--pal-text)',
    '--muted:var(--pal-slate-h)',
    '--xp:var(--pal-r-blue)',
    '--pact:var(--pal-pact)',
    '--fusion:var(--pal-r-gold)',
    '--hostile:var(--pal-heye)',
    '--objective:var(--pal-obj)',
    '--line:rgb(from var(--pal-ember-l) r g b / 25%)',
    '--panel:rgb(from var(--pal-panel) r g b / 92%)',
  ];
  const style = document.createElement('style');
  style.id = 'palette';
  style.textContent = `:root{${lines.join(';')};${alias.join(';')}}`;
  document.head.appendChild(style);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = HEX.INK;
}

installPalette();
