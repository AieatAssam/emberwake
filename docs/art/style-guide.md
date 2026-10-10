# Emberwake Art Style Guide, v1

**Status:** this is the source of truth. Every future art audit compares against this document.
**Version:** v1, 2026-10-10. It goes with **palette v1 (72 swatches)**.
**Based on:**
- the repo survey of `AieatAssam/emberwake` @ `758ad49`
- `ew-reports/drift-2026-10-10.md`
- [palette.md](palette.md)

**How rules are tagged:**
- **[Current]**: what the code does today.
- **[Rule]**: binding for new art. Where today's code breaks a Rule, the gap is called out.
- **[Proposal]**: not yet adopted. An audit reports on it but doesn't fail anything for it.

All contrast figures are WCAG 2.x ratios. All colour distances are CIE76 ΔE (Lab, D65). Code references point to `src/` at `758ad49`.

---

## 1. Pillars

**The fantasy.** *"The sun is dead. You carry the last Ember. Burn brighter than the Gloam — or be swallowed by it."* (README)

| # | Pillar | Evidence behind it | What it means on screen |
|---|---|---|---|
| P1 | **Readable battlefield** | README: *"scenery is dimmed and low-contrast; drops glow; elites and bosses carry coloured halos; chests beam."* `atlas.js:1143`: *"Background props sit back."* | You read threats, then drops, then the ground, in that order. Props never out-shout enemies. |
| P2 | **Warm friendly light vs a cold hostile dark** | *"You carry the last Ember"*, and the player's lantern, scarf and Ember Bolt are drawn in amber (`atlas.js:528-545`) | Amber belongs to the player alone. Hostile fire is a separate red-orange. Grounds are near-black and cool or earthy. |
| P3 | **The dark closes in** | README: *"The Gloam settles — stand still and the dark closes in."* There's a 0.55–0.9 edge vignette (`atlas.js:1945`). | The screen edges stay dark. Light comes from the Ember (the player glow) and from rewards. |
| P4 | **Objectives pop** | `atlas.js:1377`: *"Objective entities must pop against the dark ground: bright rims, hot glows, no dimming."* | Objectives are never dimmed, and they get the highest contrast band (§4). |

---

## 2. Medium and rendering

**[Current]**
- **Medium:** everything is procedural Canvas2D vector art, drawn at boot into one atlas (`buildAtlas`, `src/atlas.js`). There are no bitmap files. Characters are chibi (§5).
- **Atlas:** 2048×1280 logical px at **SS = 2**, so the backing sheet is 4096×2560 (`atlas.js:8`). 227 frames, plus 43 white hit-flash copies.
- **Filtering:** smooth (linear) filtering, no mipmaps (`atlas.js:1973`). Pixi is set up with `antialias: false` (`main.js`).
- **Camera zoom:** `clamp(min(w,h)/760, 0.6, 1.25)` (`game.js:487`).
- **Device pixel ratio (DPR):** capped at 2, or 1.5 on touch screens (`main.js:19`), with `autoDensity`.
- **Background:** `#0a0812`. **[Rule]** it becomes INK `#0b0614`.

**[Rule]**
- Texel magnification = sprite scale × zoom × DPR ÷ SS. It must stay ≤ 1.25 for any sprite at any supported zoom. Elites break this today (1.94); see §7.

---

## 3. Perspective and light

**Perspective [Current]**
- Top-down camera with a slight 3/4 look. Characters show their front, faces and feet. Grounded sprites sit on a contact shadow.

**Anchors [Current, Rule]**

| class | anchor (x, y) | source |
|---|---|---|
| Bearer | 0.5, 0.88 | `game.js:187` |
| Enemy | 0.5, 0.62 | `game.js:601` |
| Prop | 0.5, 0.85 | `game.js:2100` |
| Chest beam | 0.5, 0.92 | `game.js:796` |
| Particles / FX | 0.5, 0.5 | `game.js:66` |

**Light direction**
- **[Rule]** Key light comes from the **top-left**. That means:
  - linear body gradients run light at the top to dark at the bottom
  - specular dots and catchlights go upper-left of the centre
  - dark facets go lower-right
- **[Current]** most sprites already follow this. Examples: `bigEye` catchlight at (−0.9, −1.5), the gloomling and beetle sheens, the chest lid, the heart, and the Imp radial.
- **Gem fix [Rule]:** the gem light facet must move to the **upper-left** and the dark facet to the lower-right, so they agree with the specular dot at (9,9). Today the light facet is upper-right (`atlas.js:323-330`), which gives one sprite two light directions.
- **Sentinel [Rule]:** move its centred radial highlight (`atlas.js:893`) to upper-left of the centre.

**Shadows**
- **[Current]** the `shadow()` helper (`atlas.js:86`) draws a black ellipse at alpha 0.45, centred under the sprite with no sideways offset.
- **[Rule]** one rule for every character:

| sprite | shadow |
|---|---|
| Grounded characters, objectives, chests | `shadow()` at 100% width, alpha 0.45, at the foot point |
| Floating or flying characters (wraith, frost wisp, moth, stormkite, sentinel, tyrant, hollow) | `shadow()` at **70% width, alpha 0.30**, at the ground point under the body |
| Mire Lurker | its water ring counts as its shadow |

  - Gaps today: Wraith and Eclipse Tyrant have no shadow. Frost Wisp, Moth, Stormkite and Sentinel use the full grounded shadow.
- **[Rule]** pickups, projectiles and FX have no shadow (true today).
- **[Rule]** flat or decal props have no shadow: grass, reeds, lilypad, flower, cobble, drift, tidepool, kelp, vent, bones, shroom.
- **[Rule]** prop shadows are drawn before the prop dim rule, so the dim rule weakens them along with the prop. This is accepted.

---

## 4. Palette

**Reference:** [palette.md](palette.md), and the constants in [`src/palette.js`](../../src/palette.js). Drawing code and CSS variables name those swatches.

**v1 is locked at 72 swatches.** Any colour that isn't a swatch is a finding. Alpha may vary. A gradient may only blend between swatches of the same ramp, or into INK or WHITE.

**Which sides may use which ramps [Rule]**

| side | may use | may NOT use |
|---|---|---|
| Player | Player Ember, Bearer Flesh/Cloth, shared (Ink, Stone, Frost, Wood), scenery materials, Reward, FX | any hostile ramp (Hostile Fire, Hostile Signal, Gloom, Shroud, Hulk, Rot Rose, Bog, Spirit, Rim) |
| Hostile | hostile ramps, shared, FX (VOID) | Player Ember, Bearer Flesh/Cloth, Reward, Objective |
| Reward | Reward ramp, shared, scenery materials, Objective | hostile ramps, Player Ember, Bearer ramps |
| Objective | Objective, Player Ember (it is the player's flame being kindled), shared, scenery | hostile ramps |
| Scenery | Moss, Wood, Sand, Stone, Frost, Hostile Fire (hazards such as vents and burning stumps) | Player Ember, Reward, Objective, Hostile Signal, Rim |
| UI | everything except RIM; PACT, PANEL and TEXT are UI-only | RIM |
| FX | everything except RIM, PACT, PANEL, TEXT; HURT is FX-only | |

**ΔE minimums [Rule]**

| pair | min ΔE | v1 measured |
|---|---|---|
| Player Ember ramp vs Hostile Fire and Hostile Signal | 20 | 28.4 |
| Any Reward swatch vs Hostile Fire and Hostile Signal | 20 | 28.5 |
| Any player-side swatch vs Hostile Fire and Hostile Signal | 20 | 22.0 |
| Hostile Glare `#e8ff4a` vs Reward Gold `#ffd84a` | 20 | 30.5 |
| Halo colours, pairwise | 25 | 31.8 |
| Reward Gold or Shine vs Player Ember (advisory) | 10 | 12.1 |
| Any two swatches | 2.5 | 2.9 |

**Contrast bands against all 8 effective grounds [Rule]**
- Effective ground = ground tile mean × stage tint.
- Measured on the rendered core mean: pixels with alpha ≥ 150, ignoring outline pixels within 40 RGB steps of INK.

| class | band | v1 result |
|---|---|---|
| Enemy body (normal) | ≥ 3.0 | 0 of 176 cells fail (35 before) |
| Enemy body (elite, × `0xfff0d0`) | ≥ 3.0 | 0 of 176 fail (64 before) |
| Pickup / reward | ≥ 4.5 | 0 fail |
| Objective | ≥ 4.5 | 0 fail (rot pool 2.19 → 5.43) |
| Bearer | ≥ 4.0 | lowest is 4.20 (Sable) with v1; it was 4.11 (Grahm) |
| Prop, at alpha 0.8 over the ground | 1.4 – 2.0 | 1.41–1.97 (21 of 53 above 2:1 before) |
| Enemy rim composite | ≥ 3.0 | 4.24–4.36 |
| Enemy eyes / irises | ≥ 4.5 | 4.68–17.5 today |

**Effective grounds (v1)**

| stage | effective ground |
|---|---|
| Gloam | `#0c1018` |
| Ashfields | `#190e09` |
| Rimewood | `#151c2a` |
| Marsh | `#09130d` |
| Reliquary | `#140e1a` |
| Glass Dunes | `#23170d` |
| Wayfarer's March | `#161b18` |
| Stormbreak Coast | `#0e1621` |

All have luminance between 0.005 and 0.011.

---

## 5. Shape language

**Bearers [Current]**
- From `atlas.js:502`: *"drawn chibi: oversized heads, big glossy eyes, a strong silhouette and one signature prop each."*
- 64×64 frame. The player is 1.6× the 40px horde unit.

| Bearer | signature prop (from code comments) |
|---|---|
| Kael, Ashen Warden | lantern holding the last Ember, plus an ember scarf |
| Ysolde, Rime Oracle | floating-orb staff, crystal tiara |
| Pip, Clockwork Tinker | gear backpack, goggles |
| Grahm, Blood Reaver | crescent axe, horned helm |
| Lune, Moon Dancer | glaive, moon circlet |
| Brannoc, Bellwright | bronze bell, hammer |
| Sable, Gloam Hunter | crossbow and quiver |
| Orin, Hearthkeeper | pole lantern, ember shield |
| Wren, Wayfarer | wide-brim hat, staff lantern |
| Mordrel, Pactbound | orbiting contract scrolls and chains |

- **[Rule]** exactly one signature prop per Bearer, readable at 38px (zoom 0.6). Eyes use `bigEye`. Ember amber appears on every Bearer.

**Enemies by tier [Current shapes, Rule colours]**

| tier | members | shape |
|---|---|---|
| Horde | gloomling, moth, broodling, imp, scarab, stormkite, sunbearer, thief (24–40px) | one blob or one creature mass, 1–2 glowing eyes as the focal point, ramp from one material |
| Brute / stage | husk, beetle, wraith, bloater (`splitter`), spitter, sentinel, frostwisp, lurker, acolyte, forge (44–72px) | heavier mass, one readable feature (horn, cracks, tail, spikes) |
| Boss | Brood Matron 150, Cinder Colossus 190, Gloam Herald 90×120, Eclipse Tyrant 220 | silhouette fills 90–220px; boss halo HEYE |
| Special | the Hollow (110×120, can't be harmed), Gloom Totem (40×60, breakable loot) | |

- **[Rule]** an enemy's body uses one hostile material ramp. Eyes use HEYE, HGLARE, SPIRIT_L or WHITE.
- **[Rule]** the Eclipse Tyrant's light outline (`#ffb060`) is replaced by INK plus RIM (§6).

**Pickups [Current]**
- Small and faceted or iconic: gems 22×28 (tier 4 is 31×39), heart, magnet, bomb, freeze, cinder 18, flare orb.
- They use the `rim()` light inner rim. They animate in code: gem spin, heart pulse, rotation.
- **[Rule]** gem tiers are R_BLUE, R_GREEN, R_PINK, R_VIOLET, R_GOLD. No red on any good pickup.

**Chests [Current]:** 44×38, four tiers (bronze, silver, gold, ascend), with a chest beam 48×256 at alpha 0.5.

**Objectives [Current]:** waystone, hearthstone, brazier, heartflame, chapel, pilgrim, sun shard, lighthouse, rot pool.
- Upright readable silhouettes. Lit/unlit frames where there is a state.
- **[Rule]** never dimmed, ≥ 4.5:1, objective rings in OBJ.

**Props [Current]**
- Low, soft silhouettes: rocks, grass, pillars, plus 3–4 stage-own props per stage.
- **[Rule]** the single prop dim rule (§9), and no glowing focal points.

---

## 6. Outline and rim

**Colour [Rule]**
- Every silhouette is outlined in INK `#0b0614` only.
- No tinted or translucent outlines.
- Projectiles that need an edge use INK at 1.5. Pure-glow FX have no outline.
- Gaps today:
  - Wraith `rgba(10,30,40,.9)` and Frost Wisp `rgba(15,40,70,.9)` use tinted outlines.
  - Tyrant's outline is light.
  - Projectiles use their own dark tints (blade, glaive, mine, icicle, feather, meteor).
  - Damage digits are stroked in `#000`.

**Width by frame size, logical px (×SS on the atlas) [Rule]**

| frame size | silhouette width |
|---|---|
| < 30px (gems, broodling, small shots) | 1.5 |
| 30–89px (horde, brutes, Bearers, props, objectives) | 2.5 |
| ≥ 90px (bosses) | 4.0 |

- Interior detail lines: 1.2–1.6.
- Gaps today: Matron legs 6.0, Colossus 5.0, moth 2.0. Bearers use 3–9 different widths each (Orin uses 9).

**Rim [Rule], applies to hostile sprites only**
- RIM `#e6dcff` at **alpha 0.5**, 1 logical px wide, drawn **outside** the INK outline.
- Applies to all 21 enemy body frames. Elites inherit it through scaling.
- Measured composite contrast is 4.24–4.36:1. At alpha 0.35 it only measured about 2.7:1, which is why 0.5 is locked.
- Pickups keep their `rim()` inner light rim. Bearers have no rim.

---

## 7. Scale and canvas

**Size table [Current]** (hit r = hit radius, from data.js)

| class | frame px | hit r | frame ÷ 2r | on screen @ zoom 0.6 |
|---|---|---|---|---|
| Bearer | 64×64 | 14 | 2.29 | 38 |
| Horde (gloomling, moth, imp, scarab, stormkite, sunbearer) | 40×40–42 | 12–14 | 1.43–1.67 | 24 |
| Broodling | 24×24 | 9 | 1.33 | 14 (body ~8.4) |
| Brute (husk 60, beetle 52×48, sentinel 64, forge 72×64) | 44–72 | 15–32 | 1.12–1.60 | 26–43 |
| Boss: Matron / Colossus / Herald / Tyrant | 150×140 / 190 / 90×120 / 220 | 58 / 75 / 30 / 85 | 1.29 / 1.27 / 1.50 / 1.29 | 84–132 |
| Pickups: gem / cinder / heart | 22×28 / 18 / 28×26 | — | — | 13×17 / 10.8 / 17 |
| Chest | 44×38 | — | — | 26×23 |
| Prop | 20–56 wide, up to 72 tall | solids from `stage.solids` | — | 12–43 |

**[Rule]**
- Frame ÷ 2r stays between 1.25 and 1.7 for enemies.
- Outliers to fix or document: Forge 1.12. Herald's 120px banner is far bigger than its r30 hitbox.
- Minimum on-screen size at zoom 0.6:
  - enemy body ≥ 8px
  - eye or iris ≥ 1.5px radius
  - pickup ≥ 10px
- Broodling (body ~8.4px, iris ~1.7px) sits right at the floor. No new sprite may go below it.

**Elite scale and softness**
- **[Current]** elites are scaled ×1.55 (`game.js:590`). At zoom 1.25 on a DPR-2 screen the magnification is **1.94**, against 1.25 for normal sprites, so elites look soft. Bosses aren't scaled (1.25).
- **[Proposal]**, recommended: an **elite-specific redraw**. Draw `<enemy><n>_e` frames at 1.55× size into the atlas for the horde and brute tiers, and drop the runtime scale. This brings elites back to 1.25.
- Alternative: a 3× atlas (SS = 3). That brings elites to 1.29, but the sheet becomes 6144×3840, which is over the 4096 texture limit common on mobile GPUs. It would have to be split into two sheets.

---

## 8. Animation

**[Current]** frame counts and timing from the code:

| class | frames | timing |
|---|---|---|
| Bearers | 3: idle, `_s1`, `_s2` | walk phase `bob += dt·14` while moving (3 when idle); `_s1` when sin(bob) > 0.35, `_s2` when < −0.35; hop 3px (`game.js:2145-2148`) |
| Enemies and bosses | 2: `name0` / `name1` | frame index = `(anim·rate) & 1`; rate = `d.anim` swaps/s, default 4 (moth 10, broodling 12, scarab 10, stormkite 10, imp / forge / sunbearer / thief 8, acolyte 6, lurker 0 = state-driven); ±5% squash at `anim·1.6`; facing by flipping scaleX (`game.js:1630-1638`) |
| Hollow | 2 | 3 swaps/s, 4px bob at 3 rad/s |
| Totem | 1 | — |
| Hit flash | white `_w` copy, life 0.16s pop | `game.js:718` |
| Projectiles | flame, spirit, zap: 2; the rest: 1, rotated or scaled in code | rate not surveyed |
| Objectives | 2 state frames (unlit/lit): waystone, brazier, pilgrim | — |
| Pickups | 1 frame, animated in code | gem scaleX 0.4–1 at 2.2 rad/s; heart +14% pulse at 7; magnet sway ±0.3 rad at 5; bomb spins 1.5 rad/s; freeze 0.8 rad/s; flare orb spins 3 rad/s with ±10% pulse; cinder alpha 0.8–1 at 12 |

**[Proposal]** targets:
- Bearers: keep 3.
- Horde and brutes: keep 2, plus the squash.
- **Bosses: 4 frames.** Today their second frame is only a small rotation or offset, e.g. Tyrant `rotate(f·0.15)`.
- The frame-swap rate stays in `d.anim`: 4–12 swaps/s.

---

## 9. VFX and UI

**Glow rules**
- **[Current]** all glows are additive softglow or glow textures.
- Player glow:
  - scale 2.2 + 0.45·Kindle tier, alpha 0.32 + 0.06·tier
  - tint `0xff9a40`, or `0xffe090` at tier ≥ 4
  - buff tints: Bloodrage `0xff3040`, Overclock `0x60ffc0`, Shatter `0x80e0ff`
- **[Rule]**
  - The player glow uses the Player Ember ramp only (EMBER, or EMBER_H at tier ≥ 4).
  - Bloodrage moves to CRIMSON or EMBER_D, off the hostile red.
  - Big additive glows stay budgeted per frame (`game.js:1177`).

**Halos [Current]**
- softglow at scale r·3.2/64 (about 6.4·r across), alpha 0.6, on elites and bosses (`game.js:608-613`).
- **[Rule]** halo colours per class:

| class | v1 colour | was |
|---|---|---|
| Boss | HEYE `#ff3a6a` | `0xff4060` |
| Plain elite (no affix) | RIM `#e6dcff` | amber `0xffc040`, which broke amber ownership |
| Swift | FROST `#6cc8f0` | `0x40e0ff` |
| Vampiric | ROSE_L `#ff9ad0` | `0xff2040` |
| Warded | VOID `#c080ff` | `0x4a7aff` |
| Volatile | HFIRE `#ff4a2a` | `0xff8a20`, which collided with the Ember Bolt |

**Screen-edge glows**
- One shared edge texture (`makeEdgeGlowCanvas`), additive.
- Hurt vignette: tint `0xff0020` = HURT, its only use.
- Kindle glow: `0xff7a20`. **[Rule]** it moves to EMBER `#ffa030`.
- Ambient vignette: 0.55–0.9 at the edges. Nothing important may sit in the outer 10% of the screen without its own glow.

**Chests:** a beam (alpha 0.5, scale 1.2 × 1.5) plus a ring, tinted by `CHEST_COL`. **[Rule]** that becomes R_BRONZE, FROST, R_GOLD, R_VIOLET.

**Fonts**
- **[Current]** web fonts Cinzel 700/900 (`--display`) and Chakra Petch 500/600/700 (`--ui`) (`index.html:16`).
- **[Rule]**
  - Cinzel is for titles, names and display text. Chakra Petch is for everything else.
  - **Damage digits change** from `"Arial Black"` (not loaded, so it varies by platform; `atlas.js:1777`) to **Chakra Petch 700**. The atlas must wait for `document.fonts.ready` before drawing the digits, and the digit stroke becomes INK.
  - Minimum UI text is 11px. A type scale of 7 sizes **[Proposal]**: 11 / 13 / 16 / 20 / 26 / 34 / clamp-display. Today there are 16 sizes, from 9 to 40px.

**UI variables mapped to palette v1 [Rule]**

| variable | now | becomes | ΔE |
|---|---|---|---|
| `--ember` | `#ff8a2a` | EMBER `#ffa030` | 12.3 |
| `--ember2` | `#ffd27a` | EMBER_L `#ffc860` | 10.0 |
| `--ink` | `#0a0812` | INK `#0b0614` | 2.3 |
| `--panel` | `rgb(18 12 30/92%)` | PANEL `#120c1e` @ 92% | 0 |
| `--line` | `rgb(255 190 120/25%)` | EMBER_L @ 25% | — |
| `--text` | `#f3e9dc` | TEXT | 0 |
| `--muted` | `#a99bb8` | SLATE_H `#b8b4c8` | 10.4 |
| `--xp` | `#5ab8ff` | R_BLUE `#46aaff` | 9.8 |
| `--pact` | `#ff2a5a` | PACT `#8a2ad0` | 96.9 |
| `--fusion` | `#ffcf4a` | R_GOLD `#ffd84a` | 5.6 |
| new `--hostile` | (boss bar `#ff4a6a`) | HEYE `#ff3a6a` | 5.8 |
| new `--objective` | (objective head `#8af0e4`) | OBJ `#8af0e4` | 0 |

- **[Rule]** Kindle tiers become SLATE_H → EMBER → EMBER_L → EMBER_H with glow. Today they use four unrelated values: `#c8b8a8`, `--ember`, `#ffd060`, white.

---

## 10. Stages

Each stage's signature props are its `own` list.

| stage | ground swatch | tint | effective ground | mood (from `desc`) | signature props |
|---|---|---|---|---|---|
| The Gloam | G_NIGHT `#141a24` | `0xb8b8d0` | `#0c1018` | moss-choked ruins at the edge of the dark | none of its own: grass, rocks, flower, shroom, bones, pillar |
| The Ashfields | G_ASH `#1e1410` | `0xd8b8a0` | `#190e09` | scorched plains, Cinder Forges breeding imps | stump, vent (hazard), basalt |
| The Rimewood | G_NIGHT `#141a24` (was `#101a24`) | `0xc0d8ee` | `#151c2a` | frozen forest, wraiths between the trees | pine, ice cluster, snow rock |
| The Drowned Marsh | G_MARSH `#0e1612` | `0xa8c8b0` | `#09130d` | black bog, lurkers, rot pools | reeds (slow), lilypad (slow), sunken lantern |
| The Shattered Reliquary | G_RELIQ `#17121e` | `0xc8b8d8` | `#140e1a` | drowned cathedral, tombs, guttering candles | tomb, candelabra, banner, cobble |
| The Glass Dunes | G_DUNES `#241a12` | `0xe0c8a8` | `#23170d` | sun-fused wastes, scarabs like sparks | glass cluster, bone spire, drift |
| The Wayfarer's March | G_ROAD `#252a2c` | `0xb8c8b0` | `#161b18` | an endless road; the land shifts to frost, ash, dune or marsh biomes | signpost, milestone |
| The Stormbreak Coast | G_NIGHT `#141a24` (was `#0f1a22`) | `0xa8c8e0` | `#0e1621` | wrecked shore, restless sky, gales | wreck, tidepool, kelp, lightrod (hazard) |

**[Rule]**
- Stage identity comes from the ground tint plus the stage's own props. `decorTint` is dropped for props (§9 prop rule).
- The UI stage colours (`color:` in `data.js`) are UI-side, and name swatches from [`src/palette.js`](../../src/palette.js).
- Note: Gloam, Reliquary and Coast are hard to tell apart at a glance (drift §8).

---

## 11. Atlas frame naming [Current, Rule]

| pattern | meaning | example |
|---|---|---|
| `name` | single static frame | `heart`, `pillar`, `bolt` |
| `name0`, `name1` | 2-frame animation, or a state pair (unlit/lit) | `gloomling0/1`, `waystone0/1` |
| `name_s1`, `name_s2` | Bearer step frames next to the idle `name` | `warden`, `warden_s1` |
| `<frame>_w` | white hit-flash copy (`atlas.js:54`), looked up as `tex+'0_w'` | `gloomling0_w` |
| `gem0`–`gem4` | gem tiers 0–4 | |
| `chest`, `chest_silver`, `chest_gold`, `chest_ascend` | chest tiers | |
| `icon_<camelCaseId>` | 48×48 upgrade/UI icon, keyed by weapon or passive id | `icon_emberBolt`, `icon_seal_dawn` |
| `d0`–`d9`, `d!` | damage digit glyphs, 18×24 | |
| FX names | shared FX textures | `glow`, `softglow`, `ring`, `slash`, `spark`, `dot`, `smoke`, `streak`, `shadow`, `pixel` |

**[Rule]**
- Names are lowercase, or camelCase after `icon_`.
- Frame numbers start at 0.
- **[Proposal]** elite frames would be `<name><n>_e` (§7).

---

## 12. Audit checklist

Each item gives what to measure and the threshold. The method is the drift/palette method: rendered atlas, core mean, 8 effective grounds.

**Colour**
- [ ] Every colour literal in `src/` is a palette v1 swatch (alpha may vary). Count of non-swatch colours = **0**.
- [ ] No hostile sprite uses a Player Ember, Reward, Objective or Bearer swatch. Violations = **0**.
- [ ] No player-side sprite uses a hostile-ramp swatch. Violations = **0**.
- [ ] Every Reward or Player Ember colour is at least ΔE **20** from every Hostile Fire or Hostile Signal colour.
- [ ] No good pickup has a pixel cluster with hue 340–15° and saturation > 50% (no red on pickups).

**Contrast**
- [ ] Enemy body ≥ **3.0:1** on all 8 grounds, normal and elite (× `0xfff0d0`). Failing cells = **0 / 176** each.
- [ ] Pickups and objectives ≥ **4.5:1** on all 8 grounds. Failing cells = **0**.
- [ ] Bearers ≥ **4.0:1** on all 8 grounds.
- [ ] Every prop/stage pair is between **1.4 and 2.0:1**. Failing pairs = **0 / 53**.
- [ ] Enemy rim composite ≥ **3.0:1**.

**Outline and rim**
- [ ] Every silhouette stroke is INK `#0b0614`. Non-INK silhouette strokes = **0**.
- [ ] Silhouette width = 1.5 / 2.5 / 4.0 by frame class (< 30 / 30–89 / ≥ 90 px), ±0.25.
- [ ] Every enemy body frame has the RIM ring: alpha 0.5 ± 0.05, width 1 logical px, outside the outline.

**Light and shadow**
- [ ] The highlight centroid of each lit body is upper-left of the frame centre (dx < 0, dy < 0). Includes `gem0–4` and `sentinel0/1`.
- [ ] Every grounded character, objective and chest has `shadow()` at alpha 0.45. Floating characters use 0.30 at 70% width. Missing = **0**.

**Scale**
- [ ] Texel magnification ≤ **1.25** at zoom 1.25 and DPR 2, for every sprite including elites.
- [ ] At zoom 0.6: every enemy body ≥ **8px**, eyes ≥ **1.5px** radius, pickups ≥ **10px**.
- [ ] Enemy frame ÷ 2r is between **1.25 and 1.7** (documented exceptions: Forge, Herald).

**Animation**
- [ ] Bearers have 3 frames, enemies 2 (totem 1), and every enemy frame has a `_w` copy.
- [ ] `d.anim` is between 4 and 12 for every animated enemy (0 only if state-driven).

**VFX and UI**
- [ ] Halo tints match §9 exactly (6 values). No amber halo.
- [ ] HURT `#ff0020` is used only by the hurt vignette (1 use).
- [ ] The CSS `:root` variables equal the §9 table.
- [ ] Only the loaded fonts (Cinzel, Chakra Petch) appear in CSS and canvas `font` strings. `Arial` count = **0**.
- [ ] UI font sizes ≥ **11px**.

**Naming**
- [ ] Every atlas frame name matches a §11 pattern.

---

## 13. References

*(Empty for v1. The weekly sweep adds reference images and links here, with date and source.)*

| date | reference | source | why it's here |
|---|---|---|---|
| | | | |
