# Gift Re — DBA Research Portal

Interactive portal for the doctoral research "Gift Re — An AI-Powered Global Reinsurer"
(Abhay Tewari, DBA in Emerging Technologies, Golden Gate University, Cohort 6894, Chair: Dr. Siwar Jendoubi).

Sections follow the May 2026 research-proposal presentation:
01 Context & Opportunity · 02 Research & Industry Insights · 03 Solution Propositions & Evidence
(with Model A — ML float management, whose working model adds five subsections: the models, process
walkthrough, model outputs, data & model specs and check outputs — and Model B — synthetic CAT pricing) · 04 Competition, Financials & Roadmap ·
05 Team, Capital & SWOT · 06 Business Impact & Key Takeaways · Evidence base (Research paper, Interviews,
Interview insights, Documents, About the researcher).

## Layout
- `index.html` — page shell (loads Tailwind from CDN and `app.js`)
- `app.js` — built bundle (portal + React + Recharts). Committed so GitHub Pages needs no build step.
- `src/App.jsx` — the portal source (single file). `src/main.jsx` mounts it.
- `docs/` — the research documents linked from the Documents section.
- `working-model/` — the Model A working model: a standalone page (`index.html`) plus a synthetic
  `sample-quarterly-data.csv`. It loads Tailwind and Chart.js from CDNs and is deliberately
  kept out of the bundle. The portal shows its four pages as subsections of Model A by embedding it
  with `?embed=1#<page>`; it also runs on its own at `working-model/`.
- `check-outputs/` — Model A subsection 05 (`?embed=1`). Pick a quarter from Q4FY21 to the current one: saved quarters
  load from the `model_outputs` table; for others, upload the base data, score it, and optionally save it.
- `factor-builder/` — standalone page: raw quarterly export → model factors → predictions (not linked from the portal).
  Both pages call the local processing service `api/main.py` on port 8100, so they only work on a machine running
  that service, not from GitHub Pages.
- `package.json` — `npm install && npm run build` regenerates `app.js`; `npm run dev` serves with live reload.

## Deploy on GitHub Pages
Settings → Pages → Source "Deploy from a branch" → `main` / `/ (root)`.
`.nojekyll` is present so `app.js` and `docs/` are served as-is.

## Editing
All content lives in `src/App.jsx` as plain data arrays near the top of each section (CHAPTERS, QUESTIONS, THEMES,
ROSTER, ROCE_DRIVERS, CODEBOOK, DOCS, the Part1–Part6 arrays). Edit, then `npm run build`, then commit `app.js`.

Both working models are in-browser simulations built from the paper's reported figures. Each has a marked hook
(`BacktestExplorer` / `FloatSimulator` in Model A, `simulate()` in Model B) where a real Python model's output can be wired in.
