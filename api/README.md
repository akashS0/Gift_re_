# Factor builder (upload a quarter, get the model input file)

Turns a quarter's raw Bloomberg fundamentals export into the model-ready factor file, taking every
price-based factor from the Supabase price database instead of a separate monthly price spreadsheet.

## Running it

Two processes, in two terminals:

```
python api/main.py                  # the processing service  -> http://127.0.0.1:8100
cd frontend && npm run dev          # the pages               -> http://localhost:8000
```

Then open **http://localhost:8000/factor-builder/**. The page has two tabs:

- **Factors** — upload the raw `.xlsx`, get the 12-column model input file.
- **Predictions** — the same upload, plus a model, threshold and Top N, gives `Pred_Prob`, `Pred_Tag` and `Rank`.

The service needs `SUPABASE_DB_URL` in the project's `.env` (same one the database scripts use).

## What it produces

`Ticker, TMR, Momentum, Beta, Alpha, Zscore, EP, BP, SP, Dividend_Flag, DE, EPS` — the same layout as
`Q4_FY_26_As_Input_Data.xlsx`.

| Column | Where it comes from |
|---|---|
| `EP`, `BP`, `SP` | `1/PE`, `1/PB`, `1/(PX per sales)` from the upload |
| `DE`, `EPS` | copied from the upload |
| `Dividend_Flag` | 1 when the upload's dividend yield is above zero |
| `TMR` | 12-month return %, from the price database |
| `Momentum` | price change across the quarter's window |
| `Beta`, `Alpha` | daily returns in the window against the NIFTY Midcap 100 (`nsemcap`), risk-free 6.5%/4 |
| `Zscore` | quarter-end price standardised within the stock's industry |

### The two-month price lag

A quarter's prices are read two months after the quarter itself, which is when its fundamentals became
public. Q1 FY25 (Apr–Jun 2024) uses **1 Jun 2024 to 31 Aug 2024**; Q4 FY26 uses 27 Feb 2026 to 29 May 2026.
This matches `get_financial_quarter()` in the original `price_lag.ipynb`, where June, July and August map
to Q1 of the next fiscal year.

## How close is it to the old pipeline?

Checked against `Q4_FY_26_As_Input_Data.xlsx`, the most recently built quarter (1,043 shared tickers):

| Column | Agreement |
|---|---|
| `EP` `BP` `SP` `DE` `EPS` `Dividend_Flag` | identical |
| `TMR` | 95.9% identical |
| `Momentum` | 98.7% identical |
| `Zscore` | correlation 0.9989 |
| `Beta` | correlation 0.9978 (typical difference 0.014) |
| `Alpha` | correlation 0.9505 |

Two deliberate differences:

- **Split-adjusted prices.** The old files read a split as a price collapse: Adani's 12-month return is
  −55.2% in the existing file where the split-adjusted figure is +123.8%. This version is right.
- **Beta** is estimated from daily returns inside the window. That reproduces the existing file closely
  but not exactly, so small differences remain. The old code sampled only ~3 monthly prices, which is too
  few for a stable estimate.

Earlier quarters (Q1–Q3 FY26) were each built slightly differently and do not reproduce — Q1 and Q2 FY26
disagree even on `Momentum`. Q4 FY26 is the reference.

## Known limits

- **The benchmark stops on 29 May 2026.** `NSEMCAP` only ever came from the Excel exports and the June 2026
  export dropped it, so quarters whose window ends after that date get no `Beta` or `Alpha`. Include the
  `NSEMCAP Index` row in future exports to fix this.
- Tickers absent from the price database keep their fundamentals columns and get blank price factors; the
  page lists them.
- The service holds finished files in memory for 6 hours, then they expire.

## Endpoints

| Route | Purpose |
|---|---|
| `GET /api/health` | service up, and how many prices the database holds |
| `GET /api/coverage` | latest price and benchmark dates, and which quarters can be built |
| `POST /api/process` | multipart upload (`file`, optional `quarter`) -> factors, warnings, download id |
| `GET /api/download/{id}` | the finished `.xlsx` |

Interactive docs at <http://127.0.0.1:8100/docs>.


## Predictions tab

The upload is converted to factors exactly as above, then scored with the steps from `oot_preds`
(reusing `pipeline.py`): each feature is power-transformed (Yeo-Johnson, or Box-Cox for `EP` and `SP`),
the batch is standard-scaled, the ticker is label-encoded, and the model predicts. An upload that is
already in factor format is detected and used as-is, so a file built by the Factors tab can be scored
directly.

Models are read from the `models` folder:

| Model | Input | Notes |
|---|---|---|
| Bi-LSTM (16 quarter) | ticker + (11,) | the production model, used by the Streamlit app |
| CNN | ticker + (11,) | |
| LSTM | ticker + (11, 1) | |
| Temporal Fusion Transformer | ticker + (1, 11) | largest, 1.1M parameters |
| Logistic Regression | (11,) | linear baseline, no ticker embedding |

All four neural models share the same 942-ticker encoder, so a stock the models never trained on
cannot be scored; the page counts and lists those.

### Checked against the existing pipeline

Scoring Q4 FY26 with the Bi-LSTM, ours vs `pipeline.py` on `Q4_FY_26_As_Input_Data.xlsx`:
probability correlation **0.79**, rank correlation **0.86**, and **23 of the top 30** stocks match.
The gap comes from the factor differences above (mainly Beta), from a different set of scorable rows
(883 vs 942), and from a quirk inherited from the notebook: the power transforms and the scaler are
re-fitted on whatever batch is being scored rather than using the saved training statistics, so the
same stock's score shifts when the row set changes. Worth deciding whether to keep that.

The five models disagree with each other far more than they disagree with the old pipeline - the
Bi-LSTM and CNN share only 2 of their top 30. Treat model choice as a real decision, not a detail.


## Check outputs page

`frontend/check-outputs/` (Model A subsection 05 in the portal) reads the `model_outputs` table, loaded from the
`Stockwise` sheet of `Table12_validated.xlsx` with `python database/load_outputs.py <file>`.

| Route | Purpose |
|---|---|
| `GET /api/outputs/quarters` | Q4FY21 to the current quarter, each marked saved or not, and whether prices cover its window |
| `GET /api/outputs/{quarter}` | a saved quarter's rows by rank, with precision@N against the realised target where known |
| `POST /api/outputs/{quarter}/save` | store a `/api/predict` result (form field `download_id`) as that quarter's output |

Q4FY21 to Q3FY25 hold the validated out-of-time output and can't be overwritten from the page. Uploaded quarters are
saved with `set_name = 'Live'` and no target; a repeated ticker in the upload is kept once, at its best score.
