"""Build the cleaned price tables from the raw files into database/output/ (no database needed).

    python database/build.py

Afterwards check output/review.csv; fix any wrong ticker mapping in mapping/overrides.csv and
re-run. Then upload with `python database/load_supabase.py`.

Rules
  * Excel exports are the primary source. For the same stock and date, a daily Excel file wins, then
    the NSE parquet data. The weekly and monthly files are only used for securities with no NSE
    parquet data (ETFs, InvITs, delisted names), since for the rest the parquet data is daily.
  * Parquet data fills every date the Excel files are missing (e.g. Reliance after Sep 2022,
    Apr-Sep 2025, Jul-Sep 2026).
  * Only trading days are kept: from Sep 2015 the NSE calendar implied by the parquet data; before
    that, weekdays on which at least one price moved (the exports repeat prices over holidays).
  * Every (ticker code, file) series is compared with the parquet prices of the NSE symbol it was
    mapped to. Between corporate actions the ratio parquet/excel is constant, because the parquet
    data is split/bonus-adjusted to today while each export is on the basis of its own date; those
    constant stretches become adjustment_periods (adj_close = close x factor). Days on which the
    parquet price didn't move are skipped (Yahoo repeats stale prices for illiquid stocks), and the
    tolerance allows for 1-paisa rounding on low-priced shares.
      - a series that doesn't track NSE in one file but does in others: that file's rows are bad and
        are dropped (the parquet data takes their place);
      - a file where most series fail is treated as corrupt and only its verified series are kept;
      - a code that fails everywhere was mapped to the wrong company: it is split off as its own
        security under its Bloomberg code, with no gap-filling, and listed in review.csv with the
        NSE symbols whose returns match it best.
"""
import time
from fractions import Fraction

import numpy as np
import pandas as pd

from config import OUTPUT_DIR
from securities import _sec_type, build_master
from sources import read_excel_prices, read_parquet_prices

PARQUET_SOURCE = "nse_yfinance"
BYTES_PER_ROW = 64      # daily_prices heap tuple + primary-key index entry
FREE_TIER_MB = 500
LONG_OVERLAP = 20       # days of overlap needed to call a mapping verified or wrong
MAX_OUTLIER_SHARE = 0.25
CORRUPT_FILE_SHARE = 0.3
JUMP = 0.35             # adjusted daily move reported when it happens at a hand-over between sources
CLEAN_RATIOS = sorted({Fraction(p, q) for p in range(1, 11) for q in range(1, 11)} |
                      {Fraction(1, q) for q in range(11, 51)})


def source_rank(name):
    n = name.lower()
    return 2 if name == PARQUET_SOURCE else 3 if n.startswith("weekly") else 4 if n.startswith("monthly") else 1


def source_basis(name):
    if name == PARQUET_SOURCE:
        return "Yahoo Finance NSE close (Algo Trading parquet), split/bonus-adjusted to the download date"
    return "Bloomberg export; split/bonus basis as of the export date, see adjustment_periods"


def snap(x):
    """Round a price ratio to a clean split/bonus fraction when it is within 0.3% of one."""
    f = min(CLEAN_RATIOS, key=lambda c: abs(float(c) / x - 1))
    return float(f) if abs(float(f) / x - 1) < 0.003 else float(f"{x:.6g}")


def segments(ratio, tol, min_run=3):
    """Split a date-sorted ratio series into stretches of constant level.

    `tol` is the allowed relative deviation per day. A new level starts only once it holds for
    `min_run` consecutive days, so one-day glitches count as outliers instead of corporate actions.
    Returns ([(start, end, factor)], n_outliers).
    """
    idx, vals, tols = ratio.index, ratio.to_numpy(), tol.to_numpy()
    segs = [[idx[0], idx[0], [vals[0]]]]
    pend, outliers = [], 0
    for d, v, t in zip(idx[1:], vals[1:], tols[1:]):
        if abs(v / np.median(segs[-1][2][-50:]) - 1) <= t:
            segs[-1][1] = d
            segs[-1][2].append(v)
            outliers += len(pend)
            pend = []
            continue
        pend.append((d, v, t))
        if len(pend) >= min_run:
            if all(abs(x / pend[0][1] - 1) <= max(tt, pend[0][2]) for _, x, tt in pend):
                segs.append([pend[0][0], pend[-1][0], [x for _, x, _ in pend]])
                pend = []
            else:
                pend.pop(0)
                outliers += 1
    outliers += len(pend)
    return [(s, e, snap(float(np.median(v)))) for s, e, v in segs], outliers


def trading_calendar(pq):
    n = pq.groupby("date").size()
    return pd.DatetimeIndex(n[n >= 100].index)


def keep_trading_days(xl, cal):
    """Drop weekends, and holidays the exports filled by repeating the previous day's prices."""
    in_cal = xl["date"] >= cal.min()
    keep = pd.Series(False, index=xl.index)
    keep[in_cal] = xl.loc[in_cal, "date"].isin(cal)
    ok = []
    for f, g in xl[~in_cal].groupby("file"):
        w = g.pivot(index="date", columns="code", values="close").sort_index()
        moved = (w.diff().abs() > 0).any(axis=1)
        moved.iloc[0] = True
        ok.append(pd.DataFrame({"file": f, "date": w.index[moved & (w.index.dayofweek < 5)]}))
    if ok:
        ok = pd.concat(ok).assign(ok=True)
        old = xl.loc[~in_cal, ["file", "date"]].merge(ok, on=["file", "date"], how="left")
        keep[~in_cal] = old["ok"].fillna(False).to_numpy(bool)
    return xl[keep]


def check_series(xl, pq_by):
    """Compare every (symbol, code, file) Excel series with the parquet prices of its symbol."""
    checks, periods = [], []
    for (sym, code, src), g in xl.groupby(["symbol", "code", "file"]):
        p = pq_by.get(sym)
        if p is None:
            continue
        s = g.set_index("date")["close"].sort_index()
        j = pd.concat({"xl": s, "pq": p, "pq_prev": p.shift()}, axis=1, join="inner").dropna(subset=["xl", "pq"])
        j = j[j["pq"] != j["pq_prev"]]          # stale parquet days say nothing about the mapping
        if len(j) < 3:
            continue
        tol = 0.005 + 0.01 / j["xl"] + 0.01 / j["pq"]
        segs, outl = segments(j["pq"] / j["xl"], tol)
        bad = len(j) >= 10 and (outl > MAX_OUTLIER_SHARE * len(j) or len(segs) > 3 + len(j) // 500)
        checks.append(dict(symbol=sym, code=code, source=src, overlap=len(j), segments=len(segs),
                           outliers=outl, bad=bad, ratio=segs[-1][2]))
        for k, (start, _, factor) in enumerate(segs):
            periods.append(dict(symbol=sym, code=code, source=src, factor=factor,
                                valid_from=s.index.min() if k == 0 else start,
                                valid_to=s.index.max() if k == len(segs) - 1 else segs[k + 1][0] - pd.Timedelta(days=1)))
    return pd.DataFrame(checks), pd.DataFrame(periods)


def adjusted_close(px, periods):
    """close x factor for every row of px (factor 1 where no adjustment period applies)."""
    f = px[["symbol", "source", "trade_date"]].reset_index().merge(periods, on=["symbol", "source"])
    f = f[(f["trade_date"] >= f["valid_from"]) & (f["trade_date"] <= f["valid_to"])]
    factor = pd.Series(1.0, index=px.index)
    factor[f["index"].to_numpy()] = f["factor"].to_numpy()
    return px["close_paise"] / 100 * factor


def suggest(series, pq_wide_ret, top=3):
    """Parquet symbols whose daily returns best match an Excel price series."""
    common = series.index.intersection(pq_wide_ret.index)
    if len(common) < 60:
        return ""
    r = series.reindex(common).pct_change()
    c = pq_wide_ret.reindex(common).corrwith(r, drop=True).dropna().sort_values(ascending=False)
    return ", ".join(f"{s} ({v:.2f})" for s, v in c.head(top).items() if v > 0.5)


def main():
    t0 = time.time()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Reading Excel exports...")
    xl, labels = read_excel_prices()
    file_end = xl.groupby("file", observed=True)["date"].max()
    labels["file_end"] = labels["file"].map(file_end)
    last_seen = xl.groupby("code", observed=True)["date"].max()

    print("Resolving tickers...")
    secs, aliases, code_map, review = build_master(labels, last_seen)
    xl["code"] = xl["code"].astype(str)
    xl["file"] = xl["file"].astype(str)
    xl["symbol"] = xl["code"].map(code_map["symbol"])
    how = code_map["how"].value_counts()
    print(f"  {len(code_map):,} codes -> {len(secs):,} securities ({', '.join(f'{k}: {v}' for k, v in how.items())})")

    print("Reading parquet prices...")
    pq = read_parquet_prices()
    cal = trading_calendar(pq)
    print(f"  {pq['symbol'].nunique():,} symbols, trading calendar {cal.min():%Y-%m-%d} to {cal.max():%Y-%m-%d}")

    n0 = len(xl)
    xl = keep_trading_days(xl, cal)
    print(f"  dropped {n0 - len(xl):,} weekend/holiday Excel prices")

    print("Checking every Excel series against NSE prices...")
    pq_by = {s: g.set_index("date")["close"].sort_index()
             for s, g in pq[pq["symbol"].isin(set(secs["symbol"]))].groupby("symbol", observed=True)}
    checks, periods = check_series(xl, pq_by)

    fail_share = checks[checks["overlap"] >= 10].groupby("source")["bad"].mean()
    corrupt = set(fail_share[fail_share > CORRUPT_FILE_SHARE].index)
    for f in sorted(corrupt):
        in_f = checks[checks["source"] == f]
        review.append(dict(symbol="", issue="corrupt_file",
                           detail=f"{f}: {fail_share[f]:.0%} of tickers ({int(in_f['bad'].sum())}) don't match NSE prices "
                                  f"(columns out of line with the ticker row?); only its {int((~in_f['bad']).sum())} "
                                  f"verified tickers are kept, NSE prices fill the rest. Re-export this file."))
    long = checks[(checks["overlap"] >= LONG_OVERLAP) & ~checks["source"].isin(corrupt)]
    verified = set(long.loc[~long["bad"], "code"])
    suspect = set(long.loc[long["bad"], "code"]) - verified

    # drop bad (code, file) series, and everything unverified from corrupt files
    key = lambda df, src="source": df["code"] + "|" + df[src]
    bad_pairs = set(key(checks[checks["bad"] & ~checks["code"].isin(suspect)]))
    good_pairs = set(key(checks[~checks["bad"]]))
    pair = key(xl, "file")
    drop = pair.isin(bad_pairs) | (xl["file"].isin(corrupt) & ~pair.isin(good_pairs))
    for f, n in xl[drop].groupby("file").size().items():
        if f not in corrupt:
            syms = sorted(set(xl.loc[drop & (xl["file"] == f), "symbol"]))
            review.append(dict(symbol="", issue="bad_rows",
                               detail=f"{f}: {n:,} prices for {len(syms)} tickers don't match NSE and were replaced "
                                      f"by NSE prices: {' '.join(syms[:30])}{' ...' if len(syms) > 30 else ''}"))
    print(f"  {len(checks):,} series checked; dropped {int(drop.sum()):,} bad Excel prices; "
          f"{len(corrupt)} corrupt file(s); {len(suspect)} wrongly mapped code(s)")
    xl = xl[~drop]

    # wrongly mapped codes become their own security under the Bloomberg code
    if suspect:
        wide = pq.pivot(index="date", columns="symbol", values="close").pct_change(fill_method=None)
        taken = set(secs["symbol"])
        new_rows = []
        for code in sorted(suspect):
            old_sym = code_map.at[code, "symbol"]
            new_sym = code if code not in taken else f"{code}_BBG"
            taken.add(new_sym)
            b = long[(long["code"] == code) & long["bad"]].sort_values("overlap", ascending=False).iloc[0]
            series = xl[(xl["code"] == code) & (xl["file"] == b["source"])].set_index("date")["close"].sort_index()
            review.append(dict(symbol=new_sym, issue="price_mismatch",
                               detail=f"code {code} was mapped to {old_sym}, but its prices in {b['source']} don't track "
                                      f"NSE {old_sym} ({int(b['segments'])} ratio levels, {int(b['outliers'])} outliers "
                                      f"over {int(b['overlap'])} days); kept separately without gap-filling",
                               suggestion=suggest(series, wide)))
            name = next((n for n in labels.loc[labels["code"] == code, "name"] if isinstance(n, str)), None)
            new_rows.append(dict(symbol=new_sym, isin=None, name=name, bbg_code=code, industry=None,
                                 sec_type=_sec_type(new_sym, name, None, []), matched_by="split: price mismatch", codes=code))
            xl.loc[xl["code"] == code, "symbol"] = new_sym
            aliases.loc[(aliases["kind"] == "bbg") & (aliases["alias"] == code), "symbol"] = new_sym
            secs.loc[secs["symbol"] == old_sym, "codes"] = secs.loc[secs["symbol"] == old_sym, "codes"].str.replace(
                rf"(^| ){code}( |$)", " ", regex=True).str.strip()
        secs = pd.concat([secs, pd.DataFrame(new_rows)], ignore_index=True)

    print("Merging sources...")
    xl = xl.sort_values("code").drop_duplicates(["symbol", "file", "date"])  # renamed codes inside one file
    fill = pq[pq["symbol"].isin(set(xl["symbol"]))].assign(file=PARQUET_SOURCE).astype({"symbol": str})
    has_pq = set(fill["symbol"])
    px = pd.concat([xl[["symbol", "date", "close", "file"]], fill[["symbol", "date", "close", "file"]]], ignore_index=True)
    px["rank"] = px["file"].map(source_rank)
    px = px[~(px["symbol"].isin(has_pq) & (px["rank"] >= 3))]   # weekly/monthly only where NSE has nothing
    px = px.sort_values(["symbol", "date", "rank"]).drop_duplicates(["symbol", "date"])
    px["close_paise"] = (px["close"] * 100).round().astype("int64")
    px = px[px["close_paise"] > 0]
    assert px["close_paise"].max() < 2**31, "a price is too large for the integer column"
    px = px.rename(columns={"date": "trade_date", "file": "source"})[["symbol", "trade_date", "close_paise", "source"]]
    px = px.reset_index(drop=True)

    used = set(px["symbol"] + "|" + px["source"])
    periods = periods[~periods["code"].isin(suspect)]
    periods = periods.merge(checks.loc[~checks["bad"], ["code", "source"]], on=["code", "source"])
    periods = periods[(periods["factor"] != 1.0) & (periods["symbol"] + "|" + periods["source"]).isin(used)]
    periods = periods.drop(columns="code").drop_duplicates(["symbol", "source", "valid_from"]).reset_index(drop=True)

    # anything still jumping where one source hands over to the next deserves a look
    adj = adjusted_close(px, periods)
    same = px["symbol"].eq(px["symbol"].shift())
    ret = adj / adj.shift() - 1
    handover = same & px["source"].ne(px["source"].shift()) & (ret.abs() > JUMP)
    for i in px.index[handover]:
        review.append(dict(symbol=px.at[i, "symbol"], issue="source_jump",
                           detail=f"{px.at[i, 'trade_date']:%Y-%m-%d}: adj_close moves {ret[i]:+.0%} where "
                                  f"{px.at[i - 1, 'source']} hands over to {px.at[i, 'source']}; check this stock in both"))

    # outputs
    stats = px.groupby("symbol").agg(first_date=("trade_date", "min"), last_date=("trade_date", "max"),
                                     n_prices=("trade_date", "size"))
    secs = secs.merge(stats, left_on="symbol", right_index=True, how="inner")  # securities left with no prices go
    secs["parquet_used"] = secs["symbol"].isin(has_pq)
    aliases = aliases[aliases["symbol"].isin(set(secs["symbol"]))]
    sources = px["source"].value_counts().rename_axis("name").reset_index(name="rows")
    sources["rank"] = sources["name"].map(source_rank)
    sources = sources.sort_values(["rank", "name"]).reset_index(drop=True)
    sources.insert(0, "id", range(1, len(sources) + 1))
    sources["basis"] = sources["name"].map(source_basis)

    px.to_parquet(OUTPUT_DIR / "daily_prices.parquet", index=False)
    secs.to_csv(OUTPUT_DIR / "securities.csv", index=False)
    aliases.to_csv(OUTPUT_DIR / "aliases.csv", index=False)
    sources.drop(columns="rank").to_csv(OUTPUT_DIR / "price_sources.csv", index=False)
    periods.to_csv(OUTPUT_DIR / "adjustment_periods.csv", index=False)
    checks.to_csv(OUTPUT_DIR / "mapping_checks.csv", index=False)
    review = pd.DataFrame(review, columns=["symbol", "issue", "detail", "suggestion"])
    review.to_csv(OUTPUT_DIR / "review.csv", index=False)

    mb = len(px) * BYTES_PER_ROW / 1e6
    print(f"\nDone in {time.time() - t0:.0f}s -> {OUTPUT_DIR}")
    print(f"  securities: {len(secs):,}  ({secs['sec_type'].value_counts().to_dict()})")
    print(f"  prices: {len(px):,} rows, {px['trade_date'].min():%Y-%m-%d} to {px['trade_date'].max():%Y-%m-%d}")
    print("  by source:\n" + "\n".join(f"    {r.name:55s} {r.rows:>10,}" for r in sources.itertuples()))
    print(f"  adjustment periods: {len(periods):,} for {periods['symbol'].nunique():,} securities")
    print(f"  review items: {review['issue'].value_counts().to_dict()}  ->  output/review.csv")
    print(f"  estimated database size: ~{mb:.0f} MB of the {FREE_TIER_MB} MB free tier"
          + ("  ** over budget **" if mb > FREE_TIER_MB * 0.9 else ""))


if __name__ == "__main__":
    main()
