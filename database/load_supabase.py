"""Create the tables in Supabase and load database/output/ into them.

    python database/load_supabase.py

Needs SUPABASE_DB_URL in the project's .env (see database/README.md). Every run is a full
reload: the tables are emptied and refilled inside one transaction, so a failed run leaves the
previous data in place.
"""
import os
import sys
import time
from urllib.parse import unquote

import pandas as pd
import psycopg
from dotenv import load_dotenv

from config import DB_DIR, ENV_FILE, OUTPUT_DIR

CHUNK = 250_000


def copy_rows(cur, table, columns, df):
    with cur.copy(f"copy {table} ({', '.join(columns)}) from stdin (format csv)") as cp:
        for i in range(0, len(df), CHUNK):
            cp.write(df.iloc[i:i + CHUNK][columns].to_csv(index=False, header=False))
            if len(df) > CHUNK:
                print(f"    {table}: {min(i + CHUNK, len(df)):,} / {len(df):,}", flush=True)


def connection_params(url):
    """Split a postgresql:// URI into psycopg keyword arguments.

    Done by hand rather than handing psycopg the URI, so a password containing '@', ':' or '/'
    works as pasted without percent-encoding (the host is taken after the *last* '@').
    """
    rest = url.split("://", 1)[1]
    creds, _, hostpart = rest.rpartition("@")
    user, _, password = creds.partition(":")
    hostport, _, dbname = hostpart.partition("/")
    host, _, port = hostport.partition(":")
    return dict(user=unquote(user), password=unquote(password), host=host, port=int(port or 5432),
                dbname=dbname.split("?")[0] or "postgres")


def main():
    load_dotenv(ENV_FILE)
    url = os.environ.get("SUPABASE_DB_URL", "")
    if not url or "YOUR_" in url:
        sys.exit(f"Put your Supabase connection string in {ENV_FILE} first (see database/README.md).")
    params = connection_params(url)
    if not (OUTPUT_DIR / "daily_prices.parquet").exists():
        sys.exit("Run `python database/build.py` first.")

    na = dict(keep_default_na=False, na_values=[""])
    secs = pd.read_csv(OUTPUT_DIR / "securities.csv", **na)
    aliases = pd.read_csv(OUTPUT_DIR / "aliases.csv", **na)
    sources = pd.read_csv(OUTPUT_DIR / "price_sources.csv", **na)
    periods = pd.read_csv(OUTPUT_DIR / "adjustment_periods.csv", **na)
    px = pd.read_parquet(OUTPUT_DIR / "daily_prices.parquet")

    t0 = time.time()
    with psycopg.connect(**params, connect_timeout=20) as con, con.cursor() as cur:
        cur.execute("set statement_timeout = 0")
        print("Applying schema...")
        cur.execute((DB_DIR / "schema.sql").read_text())
        cur.execute("truncate daily_prices, adjustment_periods, security_aliases, securities, price_sources restart identity")

        print("Loading securities, aliases, sources...")
        copy_rows(cur, "securities", ["symbol", "isin", "name", "bbg_code", "industry", "sec_type"], secs)
        ids = dict(cur.execute("select symbol, id from securities").fetchall())
        copy_rows(cur, "price_sources", ["id", "name", "basis"], sources)
        src_ids = dict(zip(sources["name"], sources["id"]))
        aliases["security_id"] = aliases["symbol"].map(ids)
        copy_rows(cur, "security_aliases", ["alias", "kind", "security_id"], aliases)
        if len(periods):
            periods["security_id"] = periods["symbol"].map(ids)
            periods["source_id"] = periods["source"].map(src_ids)
            copy_rows(cur, "adjustment_periods", ["security_id", "source_id", "valid_from", "valid_to", "factor"], periods)

        print(f"Loading {len(px):,} daily prices...")
        px["security_id"] = px["symbol"].map(ids)
        px["source_id"] = px["source"].map(src_ids)
        px["trade_date"] = px["trade_date"].dt.strftime("%Y-%m-%d")
        assert px["security_id"].notna().all() and px["source_id"].notna().all()
        copy_rows(cur, "daily_prices", ["trade_date", "close_paise", "security_id", "source_id"], px)

        print("Committing...")
        con.commit()
        cur.execute("analyze")
        n, lo, hi = cur.execute("select count(*), min(trade_date), max(trade_date) from daily_prices").fetchone()
        size = cur.execute("select pg_size_pretty(pg_database_size(current_database()))").fetchone()[0]
    print(f"Done in {time.time() - t0:.0f}s: {n:,} prices, {lo} to {hi}; database size {size}")


if __name__ == "__main__":
    main()
