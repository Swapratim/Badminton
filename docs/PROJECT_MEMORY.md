# 🏸 Badminton — Project Memory

Canonical memory for the **IFD Badminton Match Scheduler**. This is a branch of
Swapratim Roy's [Central Memory](https://github.com/Swapratim/central-memory)
(`projects/badminton.md`).

## What it is
A static, no-login, nothing-stored **doubles roaster builder** for club badminton.
Inputs: number of players, courts, per-player level (L1–L4) + name + woman checkbox,
total rounds, and play duration. Output: a fair, balanced, **printable** match schedule
that can be **shared to WhatsApp**. Banner: *"IFD Badminton Match Scheduler"*. Refreshing
the page clears everything.

- **Live:** https://badminton-swap.pages.dev
- **Repo (public):** https://github.com/Swapratim/Badminton
- **Local source:** `/home/swap/badminton/`
- **Hosting:** Cloudflare Pages, project `badminton-swap`, account `61c63e64c763b303faeec66657b02561`.

## Architecture
| File | Role |
|------|------|
| `public/index.html` | Markup: inputs, Live Adjustments, output, rules, footer credit |
| `public/styles.css` | Sporty UI + print stylesheet (prints the table only) |
| `public/scheduler.js` | **Pure, DOM-free scheduling engine** (rules A–I) — testable in Node |
| `public/app.js` | UI layer: reads inputs, renders, print / WhatsApp share / copy |
| `test/engine.test.js` | Headless rule validation across 8 scenarios |
| `test/dom.test.js` | jsdom smoke test of the full UI wiring |
| `wrangler.toml` | Cloudflare Pages config (project `badminton-swap`, output `public`) |

## Scheduling rules (A–I + BWF)
- **A** ~5 rounds per hour (2 hr ≈ 10 rounds), auto-filled & editable.
- **B** No same pair as partners in back-to-back rounds.
- **C** Everyone in a match within 2 levels (L1 ↔ L1–L3, L4 ↔ L2–L4).
- **D** In a 10-round schedule, maximise mixed doubles with **2–3 men's doubles rounds**
  (favouring stronger players).
- **E** Women's doubles rounds when women > 40% of players.
- **F** Fair rotating rest; no one rests two rounds in a row.
- **G** A strong+weak team is matched against a similarly built team.
- **H** No repeat partnerships while unique combinations remain.
- **I** Exhaustion fallback — relax the level gap to fill remaining rounds (relaxed rounds are badged).
- **★** BWF doubles conventions (four per court; serve/side handled at the court).

The engine uses randomised greedy construction with a 3-tier relaxation ladder and
per-round scoring; rest is chosen fairest-first while avoiding back-to-back rest.

## Environment notes (important for redeploys)
- **No system Node** on this WSL box. Node 22 lives at `~/.local/node/` →
  `export PATH="$HOME/.local/node/bin:$PATH"`.
- `wrangler` + `jsdom` are local dev deps in `~/badminton/node_modules`.
- **No browser installable** (Ubuntu 26.04 unsupported by Playwright) → the UI is verified
  with jsdom, not screenshots.
- Cloudflare Pages requires a token with **Pages: Edit**. Workers-AI `cfut_` tokens
  authenticate but fail Pages with error `10000` unless they also carry Pages:Edit. Tokens
  are **never** stored in the repo or on disk — supply one at deploy time.

## Run / test / deploy
```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/badminton
npm test                                  # engine + DOM tests (0 hard issues expected)
export CLOUDFLARE_API_TOKEN=<token with Pages:Edit>
export CLOUDFLARE_ACCOUNT_ID=61c63e64c763b303faeec66657b02561
npx wrangler pages deploy public --project-name=badminton-swap --branch=main --commit-dirty=true
```

## Build history (chronological)
1. Built the full static app + DOM-free engine; headless engine & jsdom tests pass (0 rule
   violations across 8 stress scenarios).
2. Created public repo `Swapratim/Badminton`, pushed `main`.
3. Installed Node 22 to `~/.local/node`, installed wrangler locally, deployed to Cloudflare
   Pages. `badminton.pages.dev` was taken → project `badminton-swap` →
   **https://badminton-swap.pages.dev** (interim `badminton`/`-d54` project deleted).
4. UX tweaks: "Women" header aligned over the checkbox; "Developed & administered by
   Swapratim Roy" footer credit; removed A–I letter prefixes from the rules list; clause D
   updated to 2–3 men's doubles rounds (default men's-rounds knob 1 → 2).
5. Engine fix: men's/women's rounds now honour the selected count — the same-gender pairing
   bias was previously gated behind the strict relaxation tier and vanished once a round had
   to relax, capping realised men's rounds at ~2. Now a soft same-gender bias applies at all
   tiers and courts keep men-vs-men / women-vs-women composition.
6. UX fix: `Build`/`Rebuild` blur the focused field before reading inputs, so a freshly-typed
   Live-Adjustments value applies on the **first** click (native number inputs commit on blur).

See `docs/conversations/` for the full sanitised build conversation.
