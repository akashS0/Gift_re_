"""Local web service behind the factor-builder page.

    python api/main.py            # http://127.0.0.1:8100  (docs at /docs)

Endpoints
    GET  /api/health          is the service up, and does the price database answer
    GET  /api/coverage        how far the prices run, and which quarters can be built today
    GET  /api/models          the trained models available for scoring
    POST /api/process         upload a quarter's raw file -> the 12-column factor table
    POST /api/predict         same upload, plus a model -> factors with Pred_Prob / Pred_Tag / Rank
    GET  /api/download/{id}   the result of either as .xlsx
    GET  /api/outputs/quarters          Q4FY21 to the current quarter: which are saved in model_outputs
    GET  /api/outputs/{quarter}         a saved quarter's stock-by-stock output
    POST /api/outputs/{quarter}/save    store a /api/predict result as that quarter's output
"""
from __future__ import annotations

import io
import os
import sys
import uuid
from functools import lru_cache
from datetime import datetime, timedelta

import pandas as pd
import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "database"))
from config import ENV_FILE                     # noqa: E402
from load_supabase import connection_params     # noqa: E402
import load_outputs                              # noqa: E402

import factors                                   # noqa: E402
import scoring                                   # noqa: E402

app = FastAPI(title="Quant Fund factor builder", version="1.1")
# the page may be opened as localhost or as this machine's address on the network
app.add_middleware(CORSMiddleware,
                   allow_origin_regex=r"http://(localhost|127\.0\.0\.1|\d{1,3}(\.\d{1,3}){3})(:\d+)?",
                   allow_methods=["*"], allow_headers=["*"])

RESULTS: dict[str, tuple[datetime, str, bytes]] = {}   # download id -> (created, filename, xlsx bytes)
RESULT_TTL = timedelta(hours=6)
PREDICTIONS: dict[str, tuple[datetime, str, str, pd.DataFrame]] = {}  # download id -> (created, quarter, model, frame)
FIRST_OUTPUT_QUARTER = "Q4FY21"   # first out-of-time (Test) quarter in the validated file
MAPPING_DIR = os.path.join(HERE, "..", "database", "mapping", "reference")


@lru_cache(maxsize=1)
def stock_names() -> dict:
    """ticker key -> company name, from the Investment Team mapping workbooks (first file wins)."""
    names = {}
    sources = [("ISIN Ticker Mapping - Reshared - Formatted.xlsx", "Sheet1", "Ticker", "Stock List"),
               ("ISIN Ticker Mapping.xlsx", "Sheet2", "Ticker", "Company Name")]
    for filename, sheet, ticker_col, name_col in sources:
        try:
            frame = pd.read_excel(os.path.join(MAPPING_DIR, filename), sheet_name=sheet)
        except Exception as e:
            print(f"Stock names: could not read {filename}: {e}")
            continue
        for ticker, name in zip(frame[ticker_col], frame[name_col]):
            key = factors.ticker_key(ticker)
            if key and pd.notna(name) and key not in names:
                names[key] = str(name).strip()
    # tickers the workbooks don't cover: the price database's securities, by Bloomberg code or any old alias
    try:
        with connect() as con:
            rows = con.execute("""select s.bbg_code, s.name from securities s
                                  union all
                                  select a.alias, s.name from security_aliases a join securities s on s.id = a.security_id
                                  where a.kind = 'bbg'""").fetchall()
        for code, name in rows:
            key = factors.ticker_key(code)
            if key and name and key not in names:
                names[key] = name.strip()
    except Exception as e:
        print(f"Stock names: could not read securities from Supabase: {e}")
    return names


def with_names(frame: pd.DataFrame) -> pd.DataFrame:
    """Insert a Name column right after Ticker."""
    out = frame.copy()
    out.insert(out.columns.get_loc("Ticker") + 1, "Name", out["Ticker"].map(factors.ticker_key).map(stock_names()))
    return out


def connect():
    load_dotenv(ENV_FILE, override=True)
    url = os.environ.get("SUPABASE_DB_URL", "")
    if not url or "YOUR_" in url:
        print(f"No Supabase connection string in {ENV_FILE}")
        raise HTTPException(503, "price data is unavailable right now")
    try:
        return psycopg.connect(**connection_params(url), connect_timeout=20)
    except psycopg.OperationalError as e:
        print(f"Could not reach the price database: {e}")
        raise HTTPException(503, "price data is unavailable right now - please try again shortly")


def load_securities(con) -> pd.DataFrame:
    secs = pd.read_sql("select symbol, bbg_code, name, industry from securities", con)
    secs["ticker"] = secs["bbg_code"].map(factors.ticker_key)
    return secs.dropna(subset=["ticker"]).drop_duplicates("ticker")


def load_prices(con, secs: pd.DataFrame, quarter: str) -> pd.DataFrame:
    """Adjusted closes covering the quarter's window plus the 12 months before it."""
    _, end, year_ago = factors.price_window(quarter)
    rows = pd.read_sql(
        "select symbol, trade_date, adj_close from prices where trade_date between %s and %s",
        con, params=(year_ago - pd.Timedelta(days=15), end + pd.Timedelta(days=5)), parse_dates=["trade_date"])
    rows = rows.merge(secs[["symbol", "ticker"]], on="symbol", how="inner")
    return rows[["ticker", "trade_date", "adj_close"]]


def stash(frame: pd.DataFrame, filename: str) -> str:
    buffer = io.BytesIO()
    frame.to_excel(buffer, index=False, sheet_name="Sheet1")
    now = datetime.now()
    for key, (created, _, _) in list(RESULTS.items()):
        if now - created > RESULT_TTL:
            RESULTS.pop(key, None)
    token = uuid.uuid4().hex
    RESULTS[token] = (now, filename, buffer.getvalue())
    return token


def as_records(frame: pd.DataFrame, rows: int = 25) -> list[dict]:
    """JSON has no NaN: blanks go over the wire as null."""
    head = frame.head(rows).round(6)
    return head.astype(object).where(pd.notna(head), None).to_dict("records")


def build_factor_table(content: bytes, filename: str, quarter: str | None):
    """Upload -> factor table. Accepts a raw fundamentals export or an already-built factor file."""
    ready = None
    try:
        maybe = pd.read_excel(io.BytesIO(content))
        if set(["Ticker"] + scoring.pipeline.SIGN_FEAT).issubset(maybe.columns):
            ready = maybe[["Ticker"] + scoring.pipeline.SIGN_FEAT].copy()
    except Exception:
        pass
    if ready is not None:
        chosen = factors.parse_quarter(quarter) or factors.parse_quarter(filename) or "uploaded"
        return factors.Result(quarter=chosen, factors=ready, window={"note": "already a factor file, prices not used"},
                              warnings=["the upload was already in factor format, so it was used as-is"],
                              stats={"rows": len(ready),
                                     "with_all_factors": int(ready[scoring.pipeline.SIGN_FEAT].notna().all(axis=1).sum()),
                                     "missing_price_factors": int(ready["Momentum"].isna().sum()),
                                     "missing_by_column": {c: int(ready[c].isna().sum()) for c in scoring.pipeline.SIGN_FEAT},
                                     "dividend_payers": int(ready["Dividend_Flag"].fillna(0).sum())}), []

    try:
        raw, quarter_in_file = factors.read_raw_file(io.BytesIO(content))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(400, f"could not read the spreadsheet: {e}")

    chosen = factors.parse_quarter(quarter) or quarter_in_file or factors.parse_quarter(filename)
    if not chosen:
        raise HTTPException(400, "could not work out which quarter this file is for - "
                                 "choose one (for example Q4FY26) and upload again")
    with connect() as con:
        secs = load_securities(con)
        prices = load_prices(con, secs, chosen)
    if prices.empty:
        raise HTTPException(400, f"no prices are available yet for the {chosen} window")
    try:
        result = factors.build_factors(raw, prices, dict(zip(secs["ticker"], secs["industry"])), chosen)
    except ValueError as e:
        raise HTTPException(400, str(e))
    unmatched = sorted(set(raw["TICKER"]) - set(secs["ticker"]))
    return result, unmatched


@app.get("/api/health")
def health():
    with connect() as con:
        n, last = con.execute("select count(*), max(trade_date) from daily_prices").fetchone()
    return {"ok": True, "prices": n, "latest_price_date": str(last), "models": len(scoring.list_models())}


@app.get("/api/coverage")
def coverage():
    with connect() as con:
        last = con.execute("select max(trade_date) from daily_prices").fetchone()[0]
        index_last = con.execute("""select max(trade_date) from daily_prices p join securities s on s.id = p.security_id
                                    where s.symbol = 'NSEMCAP'""").fetchone()[0]
    ready = []
    for fy in range(24, 30):
        for q in ("Q1", "Q2", "Q3", "Q4"):
            label = f"{q}FY{fy}"
            _, window_end, _ = factors.price_window(label)
            if window_end.date() <= last:
                ready.append({"quarter": label, "window_end": str(window_end.date()),
                              "benchmark_ok": window_end.date() <= index_last})
    return {"latest_price_date": str(last), "benchmark_latest_date": str(index_last), "quarters": ready[-12:]}


@app.get("/api/models")
def models():
    return {"models": scoring.list_models(), "features": scoring.pipeline.SIGN_FEAT,
            "default_threshold": scoring.pipeline.THRESHOLD}


@app.post("/api/process")
async def process(file: UploadFile = File(...), quarter: str = Form(None)):
    content = await file.read()
    if not content:
        raise HTTPException(400, "the uploaded file is empty")
    result, unmatched = build_factor_table(content, file.filename, quarter)
    filename = f"{result.quarter}_as_input_data.xlsx"
    return {
        "quarter": result.quarter,
        "quarter_source": "you" if factors.parse_quarter(quarter) else "the file",
        "window": result.window,
        "stats": result.stats,
        "warnings": result.warnings,
        "unmatched_tickers": unmatched[:50],
        "unmatched_count": len(unmatched),
        "columns": list(result.factors.columns),
        "preview": as_records(result.factors),
        "download_id": stash(result.factors, filename),
        "filename": filename,
    }


@app.post("/api/predict")
async def predict(file: UploadFile = File(...), model: str = Form(...), quarter: str = Form(None),
                  threshold: float = Form(scoring.pipeline.THRESHOLD), top_n: int = Form(30)):
    content = await file.read()
    if not content:
        raise HTTPException(400, "the uploaded file is empty")
    if model not in {m["id"] for m in scoring.list_models()}:
        raise HTTPException(400, f"unknown model {model!r}")
    result, unmatched = build_factor_table(content, file.filename, quarter)
    try:
        prediction = scoring.predict(result.factors, model, threshold=threshold, top_n=top_n)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"the model failed to score this file: {type(e).__name__}: {e}")

    frame = with_names(prediction.frame.sort_values("Pred_Prob", ascending=False, na_position="last"))
    filename = f"{result.quarter}_predictions_{model.split('.')[0]}.xlsx"
    return {
        "quarter": result.quarter,
        "window": result.window,
        "factor_stats": result.stats,
        "warnings": result.warnings,
        "unmatched_count": len(unmatched),
        "summary": prediction.summary,
        "columns": list(frame.columns),
        "preview": as_records(frame, rows=len(frame)),
        "download_id": (token := stash(frame, filename)),
        "filename": filename,
    } | remember_prediction(token, result.quarter, model, frame)


def remember_prediction(token: str, quarter: str, model: str, frame: pd.DataFrame) -> dict:
    """Keep the scored frame so the page can save it to model_outputs without re-running the model."""
    PREDICTIONS[token] = (datetime.now(), quarter, model, frame)
    for key, (created, *_) in list(PREDICTIONS.items()):
        if datetime.now() - created > RESULT_TTL:
            PREDICTIONS.pop(key, None)
    return {"can_save": factors.parse_quarter(quarter) == quarter}


def quarter_sequence(first: str, last: str) -> list[str]:
    out, (q, fy) = [], (int(first[1]), int(first[4:]))
    while True:
        label = f"Q{q}FY{fy:02d}"
        out.append(label)
        if label == last:
            return out
        q, fy = (1, fy + 1) if q == 4 else (q + 1, fy)


@app.get("/api/outputs/quarters")
def output_quarters():
    current = load_outputs.fiscal_quarter(pd.Timestamp.today() + pd.offsets.QuarterEnd(0))
    with connect() as con:
        load_outputs.ensure_table(con)
        saved = {q: (n, src, model) for q, n, src, model in con.execute(
            "select quarter, count(*), min(source), min(model) from model_outputs group by quarter")}
        last_price = con.execute("select max(trade_date) from daily_prices").fetchone()[0]
    rows = []
    for label in quarter_sequence(FIRST_OUTPUT_QUARTER, current):
        _, window_end, _ = factors.price_window(label)
        n, src, model = saved.get(label, (0, None, None))
        rows.append({"quarter": label, "quarter_end": str(factors.quarter_dates(label)[1].date()),
                     "saved": n > 0, "rows": n, "source": src, "model": model,
                     "prices_ready": window_end.date() <= last_price, "window_end": str(window_end.date())})
    return {"current_quarter": current, "latest_price_date": str(last_price), "quarters": rows[::-1]}


@app.get("/api/outputs/{quarter}")
def output_for_quarter(quarter: str, top_n: int = 30):
    label = factors.parse_quarter(quarter)
    if not label:
        raise HTTPException(400, f"quarter should look like Q4FY21, got {quarter!r}")
    with connect() as con:
        frame = pd.read_sql("select * from model_outputs where quarter = %s order by pred_rank, ticker",
                            con, params=(label,))
    if frame.empty:
        raise HTTPException(404, f"there is no output for {label} yet")
    names = {c.lower(): c for c in scoring.pipeline.SIGN_FEAT} | {
        "ticker": "Ticker", "set_name": "Set", "target": "Target", "pred_prob": "Pred_Prob", "pred_rank": "Rank",
        "top30_flag": "Top 30 Flag", "current_price": "Current qtr price", "next_price": "Next qtr price",
        "qtr_return": "Return"}
    keep = (["Rank", "Ticker", "Pred_Prob", "Top 30 Flag", "Target", "Current qtr price", "Next qtr price", "Return",
             "Set"] + scoring.pipeline.SIGN_FEAT)
    display = with_names(frame.rename(columns=names)[keep])
    keep = list(display.columns)
    labelled = display["Target"].notna()
    top = display[display["Rank"] <= top_n]
    summary = {
        "rows": int(len(display)), "top_n": top_n,
        "source": frame["source"].iloc[0], "model": frame["model"].iloc[0],
        "set": ", ".join(sorted(frame["set_name"].dropna().unique())),
        "labelled": bool(labelled.any()),
        "positives": int(display["Target"].fillna(0).sum()) if labelled.any() else None,
        "hits_in_top_n": int(top["Target"].fillna(0).sum()) if labelled.any() else None,
        "mean_probability": float(display["Pred_Prob"].mean()),
        "loaded_at": str(frame["loaded_at"].max()),
    }
    if labelled.any():
        summary["precision_at_n"] = summary["hits_in_top_n"] / max(len(top), 1)
        summary["base_rate"] = summary["positives"] / len(display)
    with connect() as con:
        try:
            returns = con.execute("select strategy, qtr_return from strategy_returns where quarter = %s",
                                  (label,)).fetchall()
        except psycopg.errors.UndefinedTable:
            returns = []
    order = ["BiLSTM Top 30", "Nifty 50", "Quality 30", "Momentum 30", "Value 30"]
    returns = sorted(({"strategy": k, "return": v} for k, v in returns if v is not None),
                     key=lambda r: order.index(r["strategy"]) if r["strategy"] in order else len(order))
    filename = f"{label}_outputs.xlsx"
    return {"quarter": label, "summary": summary, "columns": keep, "rows": as_records(display, rows=len(display)),
            "strategy_returns": returns, "download_id": stash(display, filename), "filename": filename}


@app.post("/api/outputs/{quarter}/save")
def save_output(quarter: str, download_id: str = Form(...)):
    item = PREDICTIONS.get(download_id)
    if not item:
        raise HTTPException(404, "that prediction has expired - run it again, then save")
    _, predicted_quarter, model, frame = item
    label = factors.parse_quarter(quarter)
    if not label or label != predicted_quarter:
        raise HTTPException(400, f"this prediction is for {predicted_quarter}, not {quarter}")
    scored = frame[frame["Pred_Prob"].notna()].sort_values("Pred_Prob", ascending=False)
    # input files sometimes repeat a ticker; the table holds one row per stock, so keep its best-scored row
    duplicates = int(scored["Ticker"].duplicated().sum())
    scored = scored.drop_duplicates("Ticker").copy()
    scored["pred_rank"] = range(1, len(scored) + 1)
    rows = scored.rename(columns=load_outputs.RENAME).rename(columns={"Pred_Prob": "pred_prob"})
    rows["dividend_flag"] = pd.to_numeric(rows["dividend_flag"], errors="coerce").round().astype("Int64")
    rows["quarter"] = label
    rows["quarter_end"] = factors.quarter_dates(label)[1].date()
    rows["set_name"] = "Live"
    rows["target"] = None
    rows["model"] = model
    rows["source"] = "upload " + datetime.now().strftime("%Y-%m-%d %H:%M")
    for c in ("top30_flag", "current_price", "next_price", "qtr_return"):   # not known for a freshly scored quarter
        rows[c] = None
    with connect() as con:
        load_outputs.ensure_table(con)
        existing = con.execute("select min(source) from model_outputs where quarter = %s", (label,)).fetchone()[0]
        if existing and not existing.startswith("upload"):
            raise HTTPException(409, f"{label} already holds the validated output from {existing}; not overwriting it")
        load_outputs.write_rows(con, rows)
    return {"quarter": label, "saved_rows": int(len(rows)), "duplicates_dropped": duplicates, "model": model}


@app.get("/api/download/{download_id}")
def download(download_id: str):
    item = RESULTS.get(download_id)
    if not item:
        raise HTTPException(404, "that result has expired - process the file again")
    _, filename, payload = item
    return StreamingResponse(
        io.BytesIO(payload),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})


if __name__ == "__main__":
    import argparse

    import uvicorn

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--host", default="127.0.0.1",
                    help="0.0.0.0 to let other devices on your network use the page")
    ap.add_argument("--port", type=int, default=8100)
    args = ap.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)
