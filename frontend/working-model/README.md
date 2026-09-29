# Working model — ML for float management (SP1)

Standalone page: `working-model.html`. No build step; loads Tailwind, SheetJS, TensorFlow.js and Chart.js from CDNs.

## Sections
1. **The models** — infographic cards for logistic regression, random forest, CNN and BiLSTM, plus a comparison table.
2. **Process walkthrough** — the 8-step pipeline (universe, labelling, 60-day lag, 16/4 split, preprocessing, training, 1000→100→30 funnel, evaluation) and the overfitting safeguards.
3. **Model outputs** — Table 13 classifier metrics with interpretation, Table 12 backtest, growth-of-100 chart.
4. **Live check** — upload the quarterly CSV/XLSX, select models, run, get the top-100 shortlist with validation metrics; export CSV.
5. **Data & model specs** — file layout, artifact formats, feed roadmap, governance hooks.

## Integrating into the portal repo (for Claude Code)
- Copy `working-model.html` to the repo root (or `working-model/index.html`) and link it from the portal's Model A page
  (e.g. a button "Open the working model" → `working-model.html`). Do not merge it into `src/App.jsx`; it is intentionally standalone.
- Optional: `data/latest.csv` — if present, the page can be extended to auto-load it (see section 05 roadmap).
- Trained artifacts go in `models/` next to the HTML: `logistic.json`, `rf.json`, `cnn/model.json`, `bilstm/model.json` (formats in section 05).
  When present they are used automatically and the validation table shows source = "artifact".
- `sample-quarterly-data.csv` is a synthetic 1,000-stock × 12-quarter file in the required layout; the page can also generate it with one click.

## How the live check works today
Browser-side training on the labelled history in the uploaded file (positive class = top 10% by next-quarter return within each quarter),
validation on the last labelled quarter (precision@N, AUC), then scoring of the latest quarter. Ensemble = mean rank percentile across selected models.
Deep models train with TensorFlow.js (CNN: Conv1D→GlobalMaxPool; BiLSTM: Bidirectional LSTM(16)); a 12-epoch run on 11,000 rows takes roughly 30–60 s in a modern browser.
These are lightweight reference implementations — the production BiLSTM (13 factors, 16-year training) should be exported as a TF.js artifact and dropped in `models/bilstm/`.
