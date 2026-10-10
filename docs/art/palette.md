# Emberwake locked palette, 2026-10-10

This is the locked palette. The constants are [`src/palette.js`](../../src/palette.js). The rules that use them are [style-guide.md](style-guide.md). It was checked, before it landed, against a throwaway copy (the repo source plus a colour-remap shim) served by a local Vite dev server. `npm run contrast` remeasures the atlas in the repo.

**72 swatches** in 23 ramps. Sides: shared materials and neutrals, ground, player, hostile, reward, objective, scenery, UI and FX.
Contrast is WCAG 2.x. "Effective ground" means the ground tile mean multiplied by the stage tint, as in the drift report. ΔE is CIE76 (Lab, D65).

## Swatch table

The contrast column gives the min–max for the flat swatch against the 8 effective grounds.

| # | hex | id | name | ramp / step | role | side | contrast |
|---|---|---|---|---|---|---|---|
| 1 | `#0b0614` | INK | Ink | Ink & neutrals / shadow | outline for every sprite, canvas bg, pupils | shared | 1.05–1.17 |
| 2 | `#2a2836` | SLATE_D | Slate Shadow | Stone / shadow | stone/metal shadow side | shared | 1.18–1.32 |
| 3 | `#4a4660` | SLATE | Slate | Stone / base | stone, iron, cloth base | shared | 1.9–2.12 |
| 4 | `#7a7490` | SLATE_L | Slate Light | Stone / light | stone/metal lit side | shared | 3.84–4.29 |
| 5 | `#b8b4c8` | SLATE_H | Slate Highlight | Stone / highlight | metal glints, steel; UI muted text (replaces --muted #a99bb8) | shared | 8.45–9.43 |
| 6 | `#e8dcc4` | BONE | Bone | Ink & neutrals / light | bone, parchment, candle wax | shared | 12.56–14.02 |
| 7 | `#ffffff` | WHITE | White | Ink & neutrals / highlight | specular dots, eye whites, glow cores | shared | 17.05–19.04 |
| 8 | `#141a24` | G_NIGHT | Night Ground | Ground / base | ground base for Gloam, Rimewood, Stormbreak Coast (merged: were within dE 1.6-3.4) | ground | 1.0–1.09 |
| 9 | `#1e1410` | G_ASH | Ashfields Ground | Ground / base | Ashfields ground base | ground | 1.01–1.06 |
| 10 | `#0e1612` | G_MARSH | Marsh Ground | Ground / base | Drowned Marsh ground base | ground | 1.01–1.08 |
| 11 | `#17121e` | G_RELIQ | Reliquary Ground | Ground / base | Reliquary ground base | ground | 1.01–1.08 |
| 12 | `#241a12` | G_DUNES | Dunes Ground | Ground / base | Glass Dunes ground base | ground | 1.0–1.12 |
| 13 | `#252a2c` | G_ROAD | Old Road Ground | Ground / base | Wayfarer's March ground base | ground | 1.17–1.31 |
| 14 | `#b8601a` | EMBER_D | Ember Deep | Player Ember / shadow | player ember shadow, scarf shade | player | 3.84–4.29 |
| 15 | `#ffa030` | EMBER | Ember | Player Ember / base | the last Ember: scarf, lantern, bolts, Kindle, UI --ember | player | 8.38–9.36 |
| 16 | `#ffc860` | EMBER_L | Ember Light | Player Ember / light | flame body, lantern glass, UI --ember2 | player | 11.11–12.41 |
| 17 | `#fff1c0` | EMBER_H | Ember Core | Player Ember / highlight | flame core, holy light | player | 15.1–16.86 |
| 18 | `#f2c8a0` | SKIN | Skin | Bearer Flesh / base | Bearer faces/hands | player | 11.0–12.28 |
| 19 | `#b07a5a` | SKIN_D | Skin Shade | Bearer Flesh / shadow | Bearer face shade, leather | player | 4.69–5.24 |
| 20 | `#9a2038` | CRIMSON | Bearer Crimson | Bearer Cloth / base | red Bearer cloth (friendly red, darker than the hostile signal red) | player | 2.14–2.39 |
| 21 | `#b9a8ff` | MOON | Moonsilver | Bearer Cloth / light | cool Bearer accents, glaive | player | 8.21–9.16 |
| 22 | `#1e5a86` | FROST_D | Frost Deep | Frost / shadow | ice outline/shadow | shared | 2.32–2.59 |
| 23 | `#6cc8f0` | FROST | Frost | Frost / base | ice, blades, storm | shared | 9.06–10.12 |
| 24 | `#bfeaff` | FROST_L | Frost Light | Frost / light | ice lit faces, snow | shared | 13.34–14.9 |
| 25 | `#eaf9ff` | FROST_H | Frost Highlight | Frost / highlight | ice glints, lightning core | shared | 15.83–17.67 |
| 26 | `#6a1408` | HFIRE_D | Hostile Fire Deep | Hostile Fire / shadow | enemy/hazard fire shadow, imp body dark | hostile | 1.39–1.56 |
| 27 | `#c42a10` | HFIRE_B | Hostile Fire Base | Hostile Fire / base | imp body, forge mouth mid, slam ring | hostile | 2.99–3.34 |
| 28 | `#ff4a2a` | HFIRE | Hostile Fire | Hostile Fire / light | enemy cracks, enemy fire eyes, vents, volatile halo, telegraphs | hostile | 5.09–5.68 |
| 29 | `#ffa08c` | HFIRE_H | Hostile Fire Core | Hostile Fire / highlight | enemy fire hot core | hostile | 8.66–9.66 |
| 30 | `#ff3a6a` | HEYE | Hostile Signal | Hostile Signal / base | enemy eyes, boss halo, boss bar | hostile | 4.93–5.5 |
| 31 | `#e8ff4a` | HGLARE | Hostile Glare | Hostile Signal / light | yellow enemy eyes (moth, beetle, matron, lurker), tyrant crown jewels | hostile | 15.29–17.08 |
| 32 | `#5a0f1c` | HEYE_D | Hostile Signal Deep | Hostile Signal / shadow | sentinel/tyrant pupils, boss bar dark | hostile | 1.23–1.38 |
| 33 | `#62509a` | GLOOM_D | Gloom Shadow | Gloom Flesh / shadow | gloomling/matron underside | hostile | 2.54–2.84 |
| 34 | `#8a62c8` | GLOOM | Gloom | Gloom Flesh / base | gloomling/matron body top | hostile | 3.79–4.23 |
| 35 | `#b48ae8` | GLOOM_L | Gloom Light | Gloom Flesh / light | matron head, pustules, sentinel spikes lit | hostile | 6.29–7.02 |
| 36 | `#5a5080` | SHROUD_D | Shroud Shadow | Shroud / shadow | herald cloak hem, hollow shroud dark | hostile | 2.35–2.62 |
| 37 | `#9488b8` | SHROUD | Shroud | Shroud / base | herald cloak, hollow shroud | hostile | 5.26–5.87 |
| 38 | `#5a4a48` | HULK_D | Hulk Shadow | Hulk Stone / shadow | husk/colossus limbs shadow | hostile | 2.04–2.27 |
| 39 | `#86706a` | HULK | Hulk | Hulk Stone / base | husk/colossus body | hostile | 3.69–4.12 |
| 40 | `#a8948a` | HULK_L | Hulk Light | Hulk Stone / light | husk/colossus lit plate | hostile | 5.9–6.59 |
| 41 | `#5a2846` | ROSE_D | Rot Rose Shadow | Rot Rose / shadow | moth hindwing, beetle underside | hostile | 1.48–1.66 |
| 42 | `#a8506a` | ROSE | Rot Rose | Rot Rose / base | beetle shell, moth wing | hostile | 3.26–3.65 |
| 43 | `#ff9ad0` | ROSE_L | Rot Rose Light | Rot Rose / light | moth wing spots | hostile | 8.76–9.78 |
| 44 | `#3e6a2a` | BOG_D | Bog Shadow | Bog Flesh / shadow | bloater/lurker underside | hostile | 2.68–2.99 |
| 45 | `#7aa848` | BOG | Bog | Bog Flesh / base | bloater, broodling, lurker hump | hostile | 6.11–6.82 |
| 46 | `#c6f07a` | BOG_L | Bog Light | Bog Flesh / light | pustules, lurker eyes | hostile | 13.11–14.64 |
| 47 | `#14524a` | SPIRIT_D | Spirit Shadow | Spirit / shadow | wraith tail, spitter belly line | hostile | 1.9–2.12 |
| 48 | `#4ab8a0` | SPIRIT | Spirit | Spirit / base | wraith, spitter, scarab shell | hostile | 7.03–7.85 |
| 49 | `#b0f4e4` | SPIRIT_L | Spirit Light | Spirit / light | wraith eyes, spitter throat | hostile | 13.73–15.33 |
| 50 | `#e6dcff` | RIM | Enemy Rim | Hostile Rim / highlight | 1px light edge outside the enemy outline (alpha 0.5) | hostile | 13.03–14.55 |
| 51 | `#46aaff` | R_BLUE | Reward Blue | Reward / base | gem tier 0, XP bar, magnet | reward | 6.87–7.67 |
| 52 | `#3cdc6e` | R_GREEN | Reward Green | Reward / base | gem tier 1, regen | reward | 9.46–10.57 |
| 53 | `#ff6ad8` | R_PINK | Reward Pink | Reward / base | gem tier 2 (was red), heart, flare orb | reward | 6.74–7.53 |
| 54 | `#be5aff` | R_VIOLET | Reward Violet | Reward / base | gem tier 3, ascend chest | reward | 4.95–5.53 |
| 55 | `#ffd84a` | R_GOLD | Reward Gold | Reward / base | gem tier 4, cinders, gold chest, fusion UI | reward | 12.32–13.76 |
| 56 | `#c8803c` | R_BRONZE | Reward Bronze | Reward / base | bronze chest body/lid | reward | 5.37–5.99 |
| 57 | `#7a4a08` | R_GOLD_D | Reward Gold Deep | Reward / shadow | gold/cinder dark edge, bronze chest | reward | 2.28–2.55 |
| 58 | `#fff6dc` | R_LIGHT | Reward Shine | Reward / highlight | gem/pickup light facet tint | reward | 15.81–17.65 |
| 59 | `#8af0e4` | OBJ | Objective Teal | Objective / base | objective rings, waymark glyphs, objective HUD | objective | 12.72–14.2 |
| 60 | `#3aa892` | OBJ_D | Objective Teal Deep | Objective / shadow | objective ring shade, rot pool rim | objective | 5.84–6.52 |
| 61 | `#1e3a32` | MOSS_D | Moss Shadow | Moss / shadow | reeds, grass dark | scenery | 1.39–1.55 |
| 62 | `#2f5a4a` | MOSS | Moss | Moss / base | grass, stems, pillar moss | scenery | 2.18–2.43 |
| 63 | `#5a8a6a` | MOSS_L | Moss Light | Moss / light | lily pads, leaf lit | scenery | 4.29–4.79 |
| 64 | `#2a1c16` | WOOD_D | Wood Shadow | Wood / shadow | stumps, wreck dark | scenery | 1.04–1.16 |
| 65 | `#5a4630` | WOOD | Wood | Wood / base | banners poles, signposts, wreck, bearer leather | shared | 1.91–2.13 |
| 66 | `#9a7a4a` | WOOD_L | Wood Light | Wood / light | planks lit, brass, rope | shared | 4.27–4.77 |
| 67 | `#c8a878` | SAND | Sand | Sand / base | dunes drift, bone spire, desert glass base | scenery | 7.58–8.46 |
| 68 | `#120c1e` | PANEL | Panel | UI / base | UI panels (92% alpha) | ui | 1.01–1.12 |
| 69 | `#f3e9dc` | TEXT | Text | UI / light | UI text | ui | 14.21–15.87 |
| 70 | `#8a2ad0` | PACT | Pact Violet | UI / base | Dark Pact cards/slots (moved off red) | ui | 2.7–3.01 |
| 71 | `#ff0020` | HURT | Hurt | FX / base | player hurt vignette only | fx | 4.28–4.78 |
| 72 | `#c080ff` | VOID | Void | FX / base | vortex, gravewell, herald shroud fx | fx | 6.31–7.05 |

## How the 5 drift fixes are built in

1. **Lighter enemy bodies.** Gloomling's top stop is now `#8a62c8` (GLOOM) and its bottom stop `#62509a`. Matron's body and head use the same Gloom ramp. Herald's cloak and hood use the Shroud ramp (`#9488b8` / `#5a5080`). Colossus and Husk use the Hulk ramp (`#86706a`, `#a8948a`, `#5a4a48`). Lurker uses the Bog ramp (`#7aa848` / `#3e6a2a`). Moth's wings move to ROSE and Forge's stone to Hulk. These are side-specific overrides, listed in `rules.py`.
2. **Enemy light rim.** RIM `#e6dcff` at alpha 0.5 is drawn 1 logical px (2 atlas px at SS=2) *outside* the INK outline, on all 21 enemy body frames. The composite measures **4.24–4.36:1** against the grounds. At alpha 0.35 it was only 2.71–2.75:1, so 0.5 is the locked value.
3. **One prop rule.** It replaces the three `dimFrame` presets and the per-stage `decorTint`. Each prop's solid-pixel mean luminance is normalised to **0.047** (linear), with a light 0.15 desaturation, and the prop is drawn at alpha 0.8 with no decorTint. This also brightens props that were too dark: rocks and pillars, which are solid obstacles, used to measure 1.0–1.3:1.
4. **Elite tint `0xfff0d0`.** This replaces `0xffe0a0`. Halos (added 2026-10-10, v1): boss HEYE, plain elite RIM (was amber `0xffc040`), swift FROST, vampiric ROSE_L, warded VOID, volatile HFIRE. The closest pair of halos is ΔE 31.8 apart.
5. **Hostile fire vs friendly amber.** Hostile Fire is `#ff4a2a` (ramp `#6a1408`, `#c42a10`, `#ff4a2a`, `#ffa08c`). The smallest ΔE between the Player Ember ramp and any Hostile Fire or Hostile Signal swatch is **28.4** (EMBER_D vs HFIRE_B). All non-player fire (enemies, the forge, vents, burning stumps and basalt) is remapped to Hostile Fire. Player Ember (`#b8601a`, `#ffa030`, `#ffc860`, `#fff1c0`) can only be used by player, objective, UI and FX sprites. Reward sprites cannot use it either: cinders and gold use Reward Gold.
6. **Red off good pickups.** Gem tier 2, the heart and the flare orb move to Reward Pink `#ff6ad8`. The magnet's red goes to Reward Blue. The Dark Pact UI red moves to Pact Violet `#8a2ad0`. The smallest ΔE between any Reward swatch and any Hostile Fire or Signal swatch is **28.5**.

## Rules (numbers)

**Contrast against all 8 effective grounds**

| class | rule | measured on |
|---|---|---|
| Enemy body (normal **and** elite ×`fff0d0`) | ≥ 3.0:1 | rendered core mean (alpha ≥150, outline px excluded) |
| Pickup / reward | ≥ 4.5:1 | rendered core mean |
| Objective | ≥ 4.5:1 | rendered core mean |
| Props / scenery | 1.4:1 ≤ c ≤ 2.0:1 | core mean at alpha 0.8 over the ground, no decorTint |
| Enemy rim composite | ≥ 3.0:1 (measured 4.24) | RIM at alpha 0.5 over the ground |
| Base swatch of an enemy material ramp | ≥ 3.0:1 flat | GLOOM 3.81, SHROUD ≥4.5, HULK 3.71, ROSE 3.29, BOG 6.15, SPIRIT 7.07, HFIRE_B 3.01 |

Shadow-step swatches have no minimum, but they may only fill the lower or underside part of a gradient. The rendered body mean has to pass on its own.

**ΔE between sides (CIE76)**
- Player Ember ramp vs Hostile Fire and Hostile Signal: ≥ 20. Measured: 28.4.
- Any Reward swatch vs Hostile Fire and Hostile Signal: ≥ 20. Measured: 28.5.
- Any player-side swatch (including CRIMSON and SKIN) vs Hostile Fire and Hostile Signal: ≥ 20. Measured: 22.0.
- Hostile Glare `#e8ff4a` vs Reward Gold: ≥ 20. Measured: 30.5.
- Reward Gold/Shine vs Player Ember: ≥ 10, advisory. Measured: 12.1. Gold rewards and the player's flame are allowed to be cousins.
- Two swatches in the palette: ≥ 2.5. Smallest pair: G_DUNES vs WOOD_D at 2.9, a ground vs a scenery material.
- Which ramps each side may use is enforced in `rules.py:allowed()`. Hostile cannot use Player Ember, Reward, Objective, Bearer. Player cannot use any hostile ramp. Reward cannot use hostile ramps or Player Ember. Scenery cannot use Player Ember, Reward, Objective, Hostile Signal, Rim. HURT is FX-only, PACT is UI-only, RIM is hostile-only.

**Outline**
- Colour: INK `#0b0614` for every silhouette. No coloured outlines on sprites. Projectiles that need an edge use INK at 1.5, and pure-glow FX have none.
- Width in logical px (×SS on the atlas): 2.5 for frames ≤ 64 px, 1.5 for frames < 30 px (gems, small shots), 4.0 for bosses (frames ≥ 90 px). Matron's 6 becomes 4. Interior detail lines are 1.2–1.6.
- Rim: hostile only. RIM at alpha 0.5, 1 logical px outside the outline.
- Ground-contact shadow: one `shadow()` helper at alpha 0.45 for every grounded sprite. This is unchanged from the drift report recommendation and was not re-rendered.

## Verification (re-rendered atlas)

**Method.** I copied the repo to `/tmp/ew-remap` and added `palshim.js`. The shim wraps the Canvas2D setters `fillStyle`, `strokeStyle` and `shadowColor`, plus `CanvasGradient.addColorStop`. Every colour drawn into the atlas is remapped to its swatch for the current sprite's side, with alpha kept. `make()` records which sprite is being drawn. In the copy, the props use the single normalisation rule, and enemies get the rim. I ran `buildAtlas()` headless twice: once without `?pal` (baseline, which matches the original atlas pixel-for-pixel, max diff 0) and once with `?pal`. Then I re-ran the drift contrast table. Rimewood and Stormbreak grounds were adjusted analytically for the merged Night Ground base.

| check (cells = sprites × 8 grounds) | before | after |
|---|---|---|
| Enemy body < 3:1 (22 enemies) | **35/176** | **0/176** |
| Elite body < 3:1 (before ×ffe0a0, after ×fff0d0) | **64/176** | **0/176** |
| Pickups/objectives < 4.5:1 (26 sprites) | 27/208 | 0/208 |
| Pickups/objectives < 3:1 | 8/208 | 0/208 |
| Loud props > 2:1 (53 prop-on-stage pairs) | **21/53** | **0/53** |
| Props ≥ 3:1 | 15/53 | 0/53 |
| Props < 1.4:1 (invisible obstacles) | 21/53 | 0/53 |
| Bearers < 3:1 | 0/80 | 0/80 |

Props after the rule measure 1.41–1.97:1. Selected worst-cell values, before → after:

| sprite | body | elite |
|---|---|---|
| herald | 1.74 → 3.49 | 1.54 → 3.16 |
| matron | 2.42 → 3.53 | 2.09 → 3.19 |
| colossus | 2.49 → 4.31 | 2.19 → 3.97 |
| gloomling | 2.57 → 4.06 | 2.15 → 3.63 |
| lurker | 2.88 → 5.04 | 2.44 → 4.57 |
| moth | 3.07 → 3.80 | 2.69 → 3.56 |
| forge | 3.20 → 3.46 | 2.86 → 3.27 |

Pickups and objectives, before → after: rotpool 2.19 → 5.43, bronze chest 3.47 → 4.99, waystone 4.05 → 4.54, gem2 6.95 → 10.19, heart 5.87 → 9.73.

The full per-cell numbers were recorded with that check. They are not in the repo; `npm run contrast` remeasures the landed atlas.

## Colour mapping (987 → 72)

The mapping that produced v1 (not shipped with the game) had one row for each of the 987 distinct colours then in the source. Each row gave the primary side, the swatch, the ΔE of the move, the mapping for every other side that colour was used on, the largest ΔE across sides, a `moved_dE>10` flag, and source locations.

- Colours moved by ΔE > 10 on at least one side: **575 / 987**, covering 1085 of 1688 literal uses. Median primary move: ΔE 11.2.
- Largest move per colour: ≤2: 52, 2–5: 94, 5–10: 266, 10–20: 347, >20: 228.
- Many of the big moves are on purpose. Hostile oranges such as `#ff7a20` and `#ffb030` go to `#ff4a2a`. Reward reds go to pink or blue. `--pact` `#ff2a5a` goes to violet (ΔE 97). Enemy gloom purples are lifted. Hostile yellow eyes go to Hostile Glare.
- Side detection: in `atlas.js` it uses the sprite name. In `game.js` it uses line ranges (AFFIX_TINT, ENEMY_COLORS, slam/vent/volatile FX → hostile; chest/gem sparkle → reward). `weapons.js` is player, `objectives.js` is objective, and `style.css`, `ui.js` and `main.js` are UI. `data.js` ground blocks are ground, and the character colours are player. The thief tint `0xffd040` is treated as a reward signal (loot gold).

## Compromises

These are the calls made while locking v1. The repo now draws from the swatches. The ground texture noise is still the original pattern: bases use the ground swatches, and stage multiply tints stay as lighting. `npm run contrast` remeasures the atlas.

- **Quantising 987 colours to 72 is a big change.** 58% of colours move by more than ΔE 10. Gradients still blend between swatches, so sprites keep their shading, but subtle per-sprite hues are gone. For example, the 13 near-identical golds collapse into EMBER_L or R_GOLD, and the bearer cloths become FROST, MOON, CRIMSON, SLATE or MOSS. If 72 is too tight, add 1–2 cloth swatches per bearer as a "bearer accent" side.
- **Herald is now lilac-grey** (`#9488b8`). It reads much better, but it loses the "black shroud" fantasy. The void face is still INK.
- **Ground texture noise was not redrawn.** Gloam, Rimewood and Stormbreak bases are Night Ground `#141a24` (they were within ΔE 1.6–3.4). The blob and stone colours inside the texture stay as they were, so a re-rendered tile is not the same hex as the old analytical shift. Stage multiply tints are unchanged.
- **Halo colours follow the side rules.** Plain elite halo is RIM `#e6dcff`, vampiric is ROSE_L `#ff9ad0`, warded is VOID `#c080ff`. The closest pair is ΔE 31.8.
- **Scenery candles and torches lose their warmth.** They can't use Player Ember, so they go to Hostile Fire Core or Sand, and then the prop rule dims them. Wayfarer's candles and the Reliquary candelabra read cooler.
- **Glowing props were flattened.** Normalising luminance also dims the glowing props (shroom, sunken lantern, vent glow) into the 1.4–2.0 band. If a glow is meant to signal a hazard, like vents, it has to come from the separate hazard FX layer.
- **MUTED was merged into SLATE_H** (ΔE 10.4) to stay at 72 swatches.
- **The outline width rules are not re-rendered.** The current widths were kept. Only the colours, the rim and the prop rule were applied.

## Files

- [style-guide.md](style-guide.md): the art rules
- [`src/palette.js`](../../src/palette.js): the 72 swatches, ramps, halo colours, the prop rule and the contrast floors
- this document: how v1 was chosen, including the contrast numbers from the throwaway check

The generation scripts, the mapping CSV and the remap shim stayed out of the repo. They were the inputs to this lock, not something the game loads.
