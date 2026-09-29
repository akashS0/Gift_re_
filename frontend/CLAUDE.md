# Instructions for Claude Code — gift-re-portal

## What this repo is
A single-page React portal (one source file, `src/App.jsx`) presenting a DBA research project: Gift Re, an AI-powered
global reinsurer. Audience: the GGU dissertation committee. Owner: Surinder, on behalf of Abhay Tewari.

## Build & deploy
- `npm install` then `npm run build` → writes `app.js` at repo root. Always rebuild and commit `app.js` after any change to `src/`.
- Hosted on GitHub Pages from `main` root. Keep `.nojekyll`. Do not add a framework, router or CSS pipeline — Tailwind is loaded via CDN in `index.html`, and only core Tailwind utility classes are used.
- Verify a build renders before committing: `node -e` SSR check is fine, or open `index.html` via `npm run dev`.

## Conventions in `src/App.jsx`
- Design tokens at the top: `INK` (navy #12253F), `GOLD` (#C4A35A), `PANEL` (#EEF1F5), `TEAL`, `GREEN`, `RED`. Serif headlines (`SERIF`), tracked gold eyebrows via `Eyebrow`/`H2 eyebrow=`. Reuse `Card`, `DarkCard`, `Callout`, `Bullet`, `Table`, `BigStat`, `Stat`, `Note` rather than inventing new components.
- Content is data-first: edit arrays (CHAPTERS, QUESTIONS, THEMES, ROSTER, ROCE_DRIVERS, CODEBOOK, DOCS, and the local arrays inside Part1–Part6) rather than JSX where possible.
- Navigation is the `NAV` array + the `pages` map in `GiftRePortal`. Adding a section = one NAV entry + one component + one map entry.
  `sub: true` indents one level (Models A and B); `sub2: true` indents two (the working-model subsections under Model A).
- Numbers must match the source documents in `docs/`. Interview count is 21 (the deck's takeaway slide says 22; 21 is authoritative). Backtest figures come from Table 12/14 of the business plan.
- Models: keep the "Status: simulation" notes until real model output is attached. When a BiLSTM output CSV or the WGAN code arrives, add it under `docs/` or `data/`, load it in `BacktestExplorer` / `simulate()`, and update the status note and DOCS entry.
- Never commit `node_modules`. Keep the whole app in one JSX file unless the owner asks otherwise.

## The Model A working model (`working-model/`)
`working-model/index.html` is a standalone four-page app (models · process · outputs · specs) that loads
Tailwind and Chart.js from CDNs. (The browser-trained live check was removed; the factor builder replaces it.) Keep it out of `src/App.jsx` and out of the bundle — that separation is
deliberate. The portal surfaces its four pages as Model A subsections through `WorkingModelFrame`, which embeds it as
`working-model/index.html?embed=1#<page>`; `?embed=1` hides the page's own sidebar and makes it post its height to the
parent so there is no nested scrollbar. Two things to preserve when editing it:
- Height is measured synchronously, not in `requestAnimationFrame` — rAF does not fire while the frame is scrolled out
  of view, which would strand the parent at its default height.
- The page answers a `gift-re-wm-ping` message, because the portal may attach its listener after the frame has loaded.
Editing working-model content means editing that HTML file; it needs no build step.

## Pending items the owner may supply
Interview transcripts, the interview question guide, the BiLSTM notebook, the WGAN-GP/VAE code, Gift Re branding assets.
Each has a placeholder row in `DOCS`.
