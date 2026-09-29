"""Export everything in the Supabase price database to local files.

    python database/export_supabase.py                    # CSV files in database/exports/<today>/
    python database/export_supabase.py --format parquet   # Parquet instead (smaller, faster to load in pandas)
    python database/export_supabase.py --out "D:\\backup"  # choose the folder

Writes one file per table plus prices.<ext>: symbol, trade_date, close, adj_close, source, the
same rows as the `prices` view. That file is built locally from the downloaded tables with the
view's formula: asking the free-tier database for the view itself takes ~10 minutes and the pooler
drops the connection along the way, while the raw tables download in well under a minute.
daily_prices is streamed with COPY in batches of securities so an interrupted batch can be retried
on a fresh connection without starting over.
"""
import argparse
import os
import sys
import time
from datetime import date
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv
from psycopg import sql

from config import DB_DIR, ENV_FILE
from load_supabase import connection_params

BATCH = 25       # securities per COPY for daily_prices; small so a dropped transfer is cheap to redo
RETRIES = 3

SMALL = {
    "securities": "select * from securities order by id",
    "security_aliases": "select * from security_aliases order by security_id, kind, alias",
    "price_sources": "select * from price_sources order by id",
    "adjustment_periods": "select * from adjustment_periods order by security_id, source_id, valid_from",
}
DATE_COLS = ("trade_date", "valid_from", "valid_to")


class Session:
    """One pooler connection, reopened when Supabase drops it."""

    def __init__(self, params):
        self.params, self.con = params, None

    def connect(self):
        if self.con is None or self.con.closed:
            self.con = psycopg.connect(**self.params, connect_timeout=20, autocommit=True)
            self.con.execute("set statement_timeout = 0")
        return self.con

    def query(self, q):
        return self.connect().execute(q).fetchall()

    def copy(self, query, f, header):
        """Append the CSV output of `query` to open file `f`; a failed attempt is rolled back and retried."""
        stmt = sql.SQL("copy ({}) to stdout (format csv{})").format(query, sql.SQL(", header" if header else ""))
        for attempt in range(1, RETRIES + 1):
            pos = f.tell()
            try:
                with self.connect().cursor() as cur, cur.copy(stmt) as cp:
                    for chunk in cp:
                        f.write(chunk)
                return
            except psycopg.OperationalError as e:
                f.seek(pos)
                f.truncate()
                try:
                    self.con.close()
                except Exception:
                    pass
                self.con = None
                if attempt == RETRIES:
                    raise
                print(f"    connection dropped ({str(e).strip()[:60]}), retrying batch...", flush=True)
                time.sleep(3 * attempt)


def daily_price_batches(session):
    ids = [r[0] for r in session.query("select id from securities order by id")]
    return [sql.SQL("select * from daily_prices where security_id between {} and {} order by security_id, trade_date")
            .format(sql.Literal(ids[i]), sql.Literal(ids[min(i + BATCH, len(ids)) - 1]))
            for i in range(0, len(ids), BATCH)]


def save(df, out_dir, name, fmt):
    path = out_dir / f"{name}.{fmt}"
    if fmt == "parquet":
        df.to_parquet(path, index=False)
    else:
        df.to_csv(path, index=False, date_format="%Y-%m-%d")
    return path


def report(name, rows, path, t0):
    print(f"  {name:20s} {rows:>10,} rows  {path.stat().st_size / 1e6:8.1f} MB  ({time.time() - t0:.0f}s)")


def export_table(session, name, queries, out_dir, fmt):
    """Stream a table to CSV; returns it as a DataFrame (and rewrites it as parquet if asked)."""
    t0 = time.time()
    csv_path = out_dir / f"{name}.csv"
    with open(csv_path, "wb") as f:
        for i, q in enumerate(queries):
            session.copy(q, f, header=(i == 0))
            if len(queries) > 1:
                print(f"    {name}: batch {i + 1}/{len(queries)}", end="\r", flush=True)
    df = pd.read_csv(csv_path, keep_default_na=False, na_values=[""])
    for col in DATE_COLS:
        if col in df:
            df[col] = pd.to_datetime(df[col])
    if fmt == "parquet":
        csv_path.unlink()
        path = save(df, out_dir, name, fmt)
    else:
        path = csv_path
    report(name, len(df), path, t0)
    return df


def build_prices(tables, out_dir, fmt):
    """The `prices` view, computed locally: close x factor of the matching adjustment period."""
    t0 = time.time()
    px, per = tables["daily_prices"], tables["adjustment_periods"]
    m = px[["security_id", "source_id", "trade_date"]].reset_index().merge(per, on=["security_id", "source_id"])
    m = m[(m["trade_date"] >= m["valid_from"]) & (m["trade_date"] <= m["valid_to"])]
    factor = pd.Series(1.0, index=px.index)
    factor[m["index"].to_numpy()] = m["factor"].to_numpy()
    close = px["close_paise"] / 100
    prices = pd.DataFrame({
        "symbol": px["security_id"].map(tables["securities"].set_index("id")["symbol"]),
        "trade_date": px["trade_date"],
        "close": close,
        "adj_close": (close * factor).round(4),
        "source": px["source_id"].map(tables["price_sources"].set_index("id")["name"]),
    }).sort_values(["symbol", "trade_date"], kind="stable")
    report("prices", len(prices), save(prices, out_dir, "prices", fmt), t0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--format", choices=["csv", "parquet"], default="csv")
    ap.add_argument("--out", type=Path, default=DB_DIR / "exports" / date.today().isoformat())
    args = ap.parse_args()

    load_dotenv(ENV_FILE)
    url = os.environ.get("SUPABASE_DB_URL", "")
    if not url or "YOUR_" in url:
        sys.exit(f"Put your Supabase connection string in {ENV_FILE} first (see database/README.md).")

    args.out.mkdir(parents=True, exist_ok=True)
    print(f"Exporting to {args.out} ({args.format})")
    session = Session(connection_params(url))
    tables = {}
    try:
        for name, query in SMALL.items():
            tables[name] = export_table(session, name, [sql.SQL(query)], args.out, args.format)
        tables["daily_prices"] = export_table(session, "daily_prices", daily_price_batches(session), args.out, args.format)
    finally:
        if session.con is not None:
            session.con.close()
    build_prices(tables, args.out, args.format)
    print("Done.")


if __name__ == "__main__":
    main()
