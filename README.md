# EMBERWAKE

**The sun is dead. You carry the last Ember.** Burn brighter than the Gloam — or be swallowed by it.

A browser bullet-heaven survival roguelite built with **PixiJS v8** (WebGL, batched `ParticleContainer`s), with every sprite, sound and music track generated procedurally in code.

▶ **Play:** https://aieatassam.github.io/emberwake/

## What makes it Emberwake
- **Kindle** — kills feed a streak multiplier (up to x4 XP & cinders). Stop killing and it gutters out.
- **Flare** — each Bearer has an ultimate charged by kills (SPACE / gamepad A / touch button).
- **Ascension** — two max-level partner weapons fuse at a chest into one Ascended weapon, *freeing a slot*.
- **Dark Pacts** — rare draft cards that trade danger for permanent power.
- **Totems** — breakable obelisks hiding magnets, bombs, frost, healing and flare charge.
- **Overcharge** — once everything is maxed, power keeps climbing forever.
- **The Hearth** — spend cinders on permanent upgrades and new Bearers.
- 5 Bearers, 14 weapons, 7 Ascensions, 15 relics, 9 enemy types, 3 bosses, endless mode.

## Controls
WASD / arrows · SPACE flare · ESC pause · 1–4 pick upgrade · R reroll · B banish. Gamepad and touch supported.

## Dev
```bash
npm install
npm run dev     # local dev server
npm run build   # static build in dist/ (relative paths, GitHub Pages ready)
```
Deploys automatically to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`.
