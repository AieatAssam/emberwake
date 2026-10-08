# EMBERWAKE

**The sun is dead. You carry the last Ember.** Burn brighter than the Gloam — or be swallowed by it.

A browser bullet-heaven survival roguelite built with **PixiJS v8** (WebGL, batched `ParticleContainer`s), with every sprite, sound and music track generated procedurally in code.

▶ **Play:** https://aieatassam.github.io/emberwake/

## What makes it Emberwake
- **Kindle** — kills feed a streak multiplier (up to x2.5 cinders, half-strength XP bonus). Stop killing and it gutters out.
- **Flare** — each Bearer has an ultimate charged by kills (SPACE / gamepad A / touch button).
- **Ascension** — two max-level partner weapons fuse at a chest into one Ascended weapon, *freeing a slot*.
- **Dark Pacts** — rare draft cards that trade danger for permanent power.
- **Totems** — breakable obelisks hiding magnets, bombs, frost, healing and flare charge.
- **Overcharge** — once everything is maxed, every level-up auto-applies stacking power. Forever.
- **Gloam Pressure** — erase the horde faster than it arrives and the dark pushes harder, so a god-tier build always has a tide to carve through.
- **The Hearth** — spend cinders on permanent upgrades and new Bearers.
- **Stages** — The Gloam, The Ashfields and The Rimewood: distinct ground, enemy mixes and risk/reward multipliers, unlocked with cinders.
- **Feats** — 15 achievements that pay cinders, with live unlock banners.
- 5 Bearers, 14 weapons, 7 Ascensions, 15 relics, 9 enemy types, 3 bosses, 3 stages, endless mode.

## Controls
WASD / arrows · SPACE flare · ESC pause · 1–4 pick upgrade · R reroll · B banish. Gamepad and touch supported.

## Dev
In `npm run dev`, the console exposes a headless balance simulator:
`await __sim(900, 'warden')` runs the real game loop with a kiting bot and reports
level curve, kills, per-system frame cost, slow-frame breakdowns and what killed you.

```bash
npm install
npm run dev     # local dev server
npm run build   # static build in dist/ (relative paths, GitHub Pages ready)
```
Deploys automatically to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`.
