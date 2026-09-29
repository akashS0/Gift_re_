# Price database (Supabase)

Cleans the stock price files and loads them into a Supabase Postgres database.

## Where the data comes from
- **Excel exports (main source):** the Bloomberg files in `Desktop/Quant Fund 4/Data/Stock Prices/`. There's one daily history file for 1999 to Mar 2025, plus daily, weekly and monthly files from 2025 to Jun 2026.
- **NSE daily prices (fill the gaps):** the per-stock parquet files in `C:\Users\Singh\Desktop\Algo Trading\data\raw\prices\`, covering Sep 2015 to today. They're only used for the stocks in the Excel files, on dates the Excel files don't have.
- **Ticker mapping:** the Investment Team mapping files in `mapping/reference/` (Bloomberg code, ISIN and NSE symbol), plus `universe.csv` from Algo Trading.

## One-time setup
1. Create a free project at <https://supabase.com> and save the database password.
2. In the project, click **Connect**, open the **Session pooler** tab and copy the URI.
3. Paste the URI into `.env` in the project root as `SUPABASE_DB_URL=...`, and replace `[YOUR-PASSWORD]` with your password. Never share or commit `.env`.
4. Install the Python packages: `pip install -r requirements.txt`. The new ones are psycopg, python-dotenv and pyarrow.

## Running it
```
python database/build.py          # reads the raw files, writes cleaned tables to database/output/ (about 2-3 min)
python database/load_supabase.py  # creates the tables in Supabase and uploads everything (full reload)
python database/load_outputs.py "<Table12_validated>.xlsx"  # Stockwise sheet -> model_outputs (replaces the quarters in the file)
python database/export_supabase.py                   # downloads everything from Supabase to database/exports/<date>/ as CSV
python database/export_supabase.py --format parquet  # same, as Parquet (about 8x smaller, faster to load in pandas)
```
After `build.py`, open `output/review.csv`. It lists the tickers the script couldn't match, or whose prices don't match the NSE data (so it probably matched the wrong company). It suggests likely matches where it can. To fix one, add a row to `mapping/overrides.csv`, e.g. `VI,VIPIND,,,wrong ISIN in mapping file`, then run `build.py` again.

When new monthly Excel files arrive, drop them into the Excel folder and run both scripts again.

## Tables
| Table | What it holds |
|---|---|
| `securities` | One row per stock, ETF, InvIT, REIT or index: NSE symbol, ISIN, name, Bloomberg code, industry, type |
| `security_aliases` | Every old label a security appeared under: Bloomberg codes, pre-split ISINs, old NSE symbols |
| `price_sources` | Each source file, and which basis it uses for splits and bonuses |
| `daily_prices` | Closing price per security per trading day, stored as whole paise, with the file it came from |
| `adjustment_periods` | Multiplier that puts each source's prices on today's split/bonus basis |
| `prices` (view) | The table to read from: `symbol, trade_date, close, adj_close, source` |
| `model_outputs` | The model's stock-by-stock output per quarter: 11 factors, set, realised target, probability, rank. Loaded by `load_outputs.py`; the Check outputs page adds uploaded quarters |

`close` is the price exactly as the source reported it. Use `adj_close` for returns and momentum: it stays on one consistent basis across splits and bonuses, even where the history is stitched together from different files.

To keep under the 500 MB free-tier limit, only closing prices are stored, as 4-byte integers. The adjustment is stored once per corporate action, not once per row.

Anyone with the project's anon key can read the tables through the Supabase API. That's how the frontend will read them. Only the loader, which connects with the database password, can write.
