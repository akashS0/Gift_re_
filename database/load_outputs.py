"""Load the model's stock-by-stock outputs into Supabase (table `model_outputs`).

    python database/load_outputs.py "data/inputs/29Sep - Supporting working file - Updated.xlsx"

Reads the `Stockwise` sheet: one row per ticker per quarter with the 11 factors, the Train/Test set,
the realised Target, the model's probability, the backtest's Top 30 flag, and the 60-day-lag prices
(current and next quarter) with the quarter's return.

Values are stored exactly as they are in the workbook (rank, Top 30 Flag, prices and return). If the workbook
has a QoQ sheet, its quarterly returns (BiLSTM Top 30 and the indices) go to `strategy_returns` as they are. Quarters are stored as fiscal-quarter
labels (quarter ending 31 Mar 2021 -> Q4FY21) so the Check outputs page can look them up directly.

Every quarter in the file replaces what the table held for that quarter; other quarters are left alone,
including ones saved from the page after scoring an upload.
"""
from __future__ import annotations

import argparse
import os
import sys

import pandas as pd
import psycopg
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import ENV_FILE                  # noqa: E402
from load_supabase import connection_params  # noqa: E402

SCHEMA = """
create table if not exists model_outputs (
    quarter        text     not null,           -- fiscal quarter label, e.g. Q4FY21 (Jan-Mar 2021)
    quarter_end    date     not null,
    ticker         text     not null,
    tmr            double precision,
    momentum       double precision,
    beta           double precision,
    alpha          double precision,
    ep             double precision,
    bp             double precision,
    sp             double precision,
    dividend_flag  smallint,
    de             double precision,
    eps            double precision,
    zscore         double precision,
    set_name       text,                        -- Train / Test in the validated file; Live for uploaded quarters
    target         smallint,                    -- realised label; blank until the quarter's returns are known
    pred_prob      double precision,
    pred_rank      integer,                     -- 1 = highest probability within the quarter
    top30_flag     smallint,                    -- 1 = held in the backtest's Top 30 portfolio that quarter
    current_price  double precision,            -- close 2 months after quarter end (60-day lag)
    next_price     double precision,            -- close 3 months after that
    qtr_return     double precision,            -- next_price / current_price - 1
    model          text     not null,
    source         text     not null,           -- file the rows came from
    loaded_at      timestamptz not null default now(),
    primary key (quarter, ticker)
);
alter table model_outputs add column if not exists top30_flag smallint;
alter table model_outputs add column if not exists current_price double precision;
alter table model_outputs add column if not exists next_price double precision;
alter table model_outputs add column if not exists qtr_return double precision;
create index if not exists model_outputs_quarter_rank on model_outputs (quarter, pred_rank);
alter table model_outputs enable row level security;
do $$ begin
    if not exists (select 1 from pg_policies where tablename = 'model_outputs' and policyname = 'public read') then
        create policy "public read" on model_outputs for select to anon, authenticated using (true);
    end if;
end $$;
"""

COLUMNS = ["quarter", "quarter_end", "ticker", "tmr", "momentum", "beta", "alpha", "ep", "bp", "sp",
           "dividend_flag", "de", "eps", "zscore", "set_name", "target", "pred_prob", "pred_rank",
           "top30_flag", "current_price", "next_price", "qtr_return", "model", "source"]
RENAME = {"Ticker": "ticker", "TMR": "tmr", "Momentum": "momentum", "Beta": "beta", "Alpha": "alpha",
          "EP": "ep", "BP": "bp", "SP": "sp", "Dividend_Flag": "dividend_flag", "DE": "de", "EPS": "eps",
          "Zscore": "zscore", "Set": "set_name", "Target": "target",
          "Prediction Probabilty": "pred_prob", "Prediction Probability": "pred_prob", "Prediction Rank": "pred_rank",
          "Top 30 Flag": "top30_flag", "Current qtr price": "current_price", "Next qtr price": "next_price",
          "Return's": "qtr_return", "Returns": "qtr_return"}
DEFAULT_MODEL = "bi_lstm_top200_xform_16qtr.keras"


def fiscal_quarter(end: pd.Timestamp) -> str:
    """Indian fiscal quarters: Apr-Jun = Q1 ... Jan-Mar = Q4 of the year ending in March."""
    q = {6: 1, 9: 2, 12: 3, 3: 4}[end.month]
    fy = end.year + (1 if end.month > 3 else 0)
    return f"Q{q}FY{fy % 100:02d}"


def connect():
    load_dotenv(ENV_FILE, override=True)
    url = os.environ.get("SUPABASE_DB_URL", "")
    if not url or "YOUR_" in url:
        sys.exit(f"No Supabase connection string in {ENV_FILE}")
    return psycopg.connect(**connection_params(url), connect_timeout=20)


def ensure_table(con):
    con.execute(SCHEMA)


def write_rows(con, frame: pd.DataFrame):
    """Replace the quarters present in `frame` with its rows."""
    frame = frame[COLUMNS].astype(object).where(pd.notna(frame[COLUMNS]), None)
    with con.cursor() as cur:
        cur.execute("delete from model_outputs where quarter = any(%s)", (sorted(frame["quarter"].unique()),))
        with cur.copy(f"copy model_outputs ({', '.join(COLUMNS)}) from stdin") as copy:
            for row in frame.itertuples(index=False, name=None):
                copy.write_row(row)


RETURNS_SCHEMA = """
create table if not exists strategy_returns (
    quarter     text not null,                  -- fiscal quarter label, e.g. Q4FY21
    strategy    text not null,                  -- BiLSTM Top 30, Nifty 50, Quality 30, Momentum 30, Value 30
    qtr_return  double precision,               -- the quarter's return, as in the workbook's QoQ sheet
    source      text not null,
    loaded_at   timestamptz not null default now(),
    primary key (quarter, strategy)
);
alter table strategy_returns enable row level security;
do $$ begin
    if not exists (select 1 from pg_policies where tablename = 'strategy_returns' and policyname = 'public read') then
        create policy "public read" on strategy_returns for select to anon, authenticated using (true);
    end if;
end $$;
"""


def read_qoq(path: str, sheet: str = "QoQ") -> pd.DataFrame:
    """The QoQ sheet's quarter-by-quarter returns (header row 4), long format, values as in the workbook."""
    wide = pd.read_excel(path, sheet_name=sheet, header=3, usecols="A:F")
    wide = wide[wide["Quarter"].astype(str).str.fullmatch(r"Q[1-4]FY\d{2}")]
    long = wide.melt(id_vars="Quarter", var_name="strategy", value_name="qtr_return").rename(columns={"Quarter": "quarter"})
    long["source"] = os.path.basename(path)
    return long


def write_returns(con, frame: pd.DataFrame):
    con.execute(RETURNS_SCHEMA)
    frame = frame.astype(object).where(pd.notna(frame), None)
    with con.cursor() as cur:
        cur.execute("delete from strategy_returns where quarter = any(%s)", (sorted(frame["quarter"].unique()),))
        cur.executemany("insert into strategy_returns (quarter, strategy, qtr_return, source) values (%s, %s, %s, %s)",
                        frame[["quarter", "strategy", "qtr_return", "source"]].values.tolist())


def read_stockwise(path: str, sheet: str) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name=sheet).rename(columns=RENAME)
    missing = [c for c in ["ticker", "Quarter", "pred_prob", "pred_rank"] if c not in df.columns]
    if missing:
        sys.exit(f"The {sheet} sheet is missing column(s): {', '.join(missing)}")
    df["quarter_end"] = pd.to_datetime(df["Quarter"]).dt.date
    df["quarter"] = pd.to_datetime(df["Quarter"]).map(fiscal_quarter)
    for c in ("pred_rank", "top30_flag", "target", "dividend_flag"):   # whole numbers; blanks force pandas to float
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").round().astype("Int64")
    df["model"] = DEFAULT_MODEL
    df["source"] = os.path.basename(path)
    for c in COLUMNS:
        if c not in df.columns:
            df[c] = None
    return df


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--sheet", default="Stockwise")
    args = ap.parse_args()

    df = read_stockwise(args.file, args.sheet)
    print(f"{len(df):,} rows, {df['quarter'].nunique()} quarters ({df['quarter'].iloc[df['quarter_end'].argmin()]}"
          f" to {df['quarter'].iloc[df['quarter_end'].argmax()]}), {df['ticker'].nunique()} tickers")
    with connect() as con:
        ensure_table(con)
        write_rows(con, df)
        n, q = con.execute("select count(*), count(distinct quarter) from model_outputs").fetchone()
        print(f"model_outputs now holds {n:,} rows across {q} quarters")
        if "QoQ" in pd.ExcelFile(args.file).sheet_names:
            qoq = read_qoq(args.file)
            write_returns(con, qoq)
            print(f"strategy_returns: {qoq['quarter'].nunique()} quarters x {qoq['strategy'].nunique()} strategies "
                  f"from the QoQ sheet")


if __name__ == "__main__":
    main()
