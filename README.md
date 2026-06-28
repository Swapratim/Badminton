# 🏸 IFD Badminton Match Scheduler

A sleek, sporty **doubles roaster builder** for club badminton. Enter your players,
courts, levels and play time — it generates a fair, balanced, printable match schedule
you can share straight to WhatsApp.

**Live:** https://badminton-swap.pages.dev

- ✅ No login, no sign-up
- ✅ Nothing is stored — everything lives in the browser and clears on refresh
- ✅ 100% static (HTML/CSS/JS), deployed on Cloudflare Pages
- ✅ Printable schedule (table only) and one-tap WhatsApp share

---

## Inputs

| Input | Notes |
|-------|-------|
| Number of players | Generates a row per player |
| Number of courts | 4 players per court |
| Player level | L1–L4, per player |
| Gender | Tick the box for women |
| Total rounds | Auto-filled from duration, fully editable |
| Duration (hours) | ~5 rounds per hour |

## Scheduling rules (A–I + BWF conventions)

- **A — Rounds from time.** ~5 rounds per hour (2 hrs ≈ 10 rounds).
- **B — No consecutive repeats.** The same pair isn't partnered in back-to-back rounds.
- **C — Close levels.** Everyone in a match is within 2 levels (e.g. L1 plays with/against L1–L3).
- **D — Mixed-first.** Most rounds are mixed doubles, with 1–2 men's doubles rounds favouring stronger players.
- **E — Women's doubles.** When women are > 40% of players, 1–2 women's doubles rounds are added.
- **F — Fair rest.** If players outnumber court slots, rest rotates evenly and no one rests two rounds in a row.
- **G — Balanced sides.** A strong+weak team is matched against a similarly built team.
- **H — No repeat partnerships** while unique combinations remain.
- **I — Exhaustion fallback.** If valid combinations run out before the target rounds, rule C is relaxed to fill the schedule (relaxed rounds are badged).
- **★ BWF conventions.** Doubles only, four per court; serve rotation & side balance are handled at the court.

The rules are shown on the page, and a **Live Adjustments** panel lets you tweak the level
gap, men's/women's rounds, the L1/L4 "stronger" direction, and add custom notes — all
session-only (nothing is saved).

## Architecture

- `public/index.html` — markup
- `public/styles.css` — sporty UI + print stylesheet (prints the table only)
- `public/scheduler.js` — the pure, DOM-free scheduling engine
- `public/app.js` — UI layer (reads inputs, renders, share/print)
- `test/engine.test.js` — headless rule validation across scenarios
- `test/dom.test.js` — jsdom smoke test of the full UI wiring

## Develop & test

```bash
npm install        # installs jsdom (dev only)
npm test           # engine + DOM tests
npm run deploy     # Cloudflare Pages (needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
```

Open `public/index.html` directly in a browser — no build step.

## Deploy

Static site on **Cloudflare Pages**:

```bash
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<id> \
  wrangler pages deploy public --project-name=badminton-swap --branch=main
```

---

Built for IFD club play. MIT licensed.
