"""Turn a quarter's raw Bloomberg fundamentals export into the model-ready factor file.

Output columns, in the order the model expects:
    Ticker, TMR, Momentum, Beta, Alpha, Zscore, EP, BP, SP, Dividend_Flag, DE, EPS

From the uploaded file:  EP = 1/PE, BP = 1/PB, SP = 1/(PX/SALES), DE and EPS as-is,
Dividend_Flag = 1 when the dividend yield is above zero.
From the price database:  TMR, Momentum, Beta, Alpha, Zscore.

The price window lags the fiscal quarter by two months, which is when the quarter's fundamentals
actually became public: for quarter Q the window runs from (Q's previous quarter end + 2 months)
to (Q's end + 2 months), using the last trading day on or before each. Q1 FY26 (Apr-Jun 2025)
therefore uses 30 May 2025 to 29 Aug 2025 - the window the original notebook hard-codes.

Checked against Q4_FY_26_As_Input_Data.xlsx (the most recently built quarter): Momentum matches
exactly, Beta correlates 0.998, Zscore 0.998, Alpha 0.95. TMR matches except for stocks that split
during the year, where this version is right and the old file is wrong - it uses split-adjusted
prices, so a 1:5 split is no longer read as an 80% fall.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

OUTPUT_COLUMNS = ["Ticker", "TMR", "Momentum", "Beta", "Alpha", "Zscore",
                  "EP", "BP", "SP", "Dividend_Flag", "DE", "EPS"]
INDEX_TICKER = "nsemcap"          # NIFTY Midcap 100, the benchmark for Beta and Alpha
RISK_FREE_QUARTERLY = 0.065 / 4   # 6.5% a year, as in the original notebook
QUARTER_END_MONTH = {"Q1": 6, "Q2": 9, "Q3": 12, "Q4": 3}
PRICE_LAG_MONTHS = 2
MISSING_STRINGS = ["#N/A N/A", "#N/A", "#VALUE!", "#NAME?", "-", "NA", "N/A", ""]

# every spelling of the five fields we need, lower-cased and stripped of spaces/punctuation
ALIASES = {
    "PE": ["pe", "p/e", "price_to_diluted_eps", "peratio", "pe_ratio"],
    "PB": ["pb", "p/b", "px_to_book_ratio", "pbratio", "pb_ratio"],
    "PS": ["px/sales", "px/ sales", "p/s", "pricetosalesratio", "price to sales ratio", "px_sales", "ps"],
    "DE": ["d/e", "de", "tot_debt_to_tot_eqy", "debttoequity"],
    "EPS": ["eps", "trail_12m_eps", "is_eps"],
    "DIV_YIELD": ["dividendyield", "dividend yield", "dividend", "div_yield", "eqy_dvd_yld_12m", "dvd_yield"],
    "TICKER": ["ticker", "ticker/(inmillions)", "ticker / (in millions)", "tickers", "symbol", "bloombergcode"],
}


def _norm(name) -> str:
    return re.sub(r"[\s_]+", "", str(name)).strip().lower()


def _alias_lookup() -> dict:
    out = {}
    for field_name, spellings in ALIASES.items():
        for s in spellings:
            out[_norm(s)] = field_name
    return out


ALIAS_MAP = _alias_lookup()


def ticker_key(label) -> str | None:
    """'RELIANCE IN Equity ' / 'RELIANCE IN' / 'Reliance' -> 'reliance'."""
    if label is None or (isinstance(label, float) and np.isnan(label)):
        return None
    t = str(label).strip()
    t = re.sub(r"\s+(IN\s+)?(Equity|Index)\s*$", "", t, flags=re.I).strip()
    t = re.sub(r"\s+IN$", "", t, flags=re.I).strip()
    return t.lower() or None


def parse_quarter(text) -> str | None:
    """Accepts 'Q4FY26', 'Q4_FY_26', "Mar'26", 'Raw Data Q4_FY26.xlsx' -> 'Q4FY26'."""
    if not text:
        return None
    s = str(text).upper().replace(" ", "")
    m = re.search(r"Q([1-4])_?FY_?(\d{2,4})", s)
    if m:
        return f"Q{m.group(1)}FY{m.group(2)[-2:]}"
    m = re.search(r"(MAR|JUN|SEP|DEC)'?(\d{2,4})", s)   # Bloomberg banner, e.g. Mar'26
    if m:
        q = {"JUN": "Q1", "SEP": "Q2", "DEC": "Q3", "MAR": "Q4"}[m.group(1)]
        return f"{q}FY{m.group(2)[-2:]}"
    return None


def quarter_dates(quarter: str) -> tuple[pd.Timestamp, pd.Timestamp]:
    """'Q4FY26' -> (calendar start, calendar end) = (2026-01-01, 2026-03-31)."""
    m = re.fullmatch(r"Q([1-4])FY(\d{2})", quarter.upper())
    if not m:
        raise ValueError(f"quarter should look like Q4FY26, got {quarter!r}")
    q, fy = f"Q{m.group(1)}", 2000 + int(m.group(2))
    end_month = QUARTER_END_MONTH[q]
    year = fy if q == "Q4" else fy - 1      # Indian fiscal year: Q1 = Apr-Jun of fy-1
    end = pd.Timestamp(year, end_month, 1) + pd.offsets.MonthEnd(0)
    return end - pd.offsets.MonthBegin(3), end


def price_window(quarter: str) -> tuple[pd.Timestamp, pd.Timestamp, pd.Timestamp]:
    """Calendar (not trading) dates: (window start, window end, 12 months before the end)."""
    _, q_end = quarter_dates(quarter)
    end = q_end + pd.offsets.MonthEnd(PRICE_LAG_MONTHS)
    return end - pd.offsets.MonthEnd(3), end, end - pd.DateOffset(years=1)


@dataclass
class Result:
    quarter: str
    factors: pd.DataFrame
    window: dict
    warnings: list = field(default_factory=list)
    stats: dict = field(default_factory=dict)


def read_raw_file(content: bytes, sheet=None) -> tuple[pd.DataFrame, str | None]:
    """Read a raw fundamentals export into columns TICKER/PE/PB/PS/DE/EPS/DIV_YIELD.

    Handles the layouts seen across quarters: a two-row Bloomberg banner with the quarter in cell
    B1, a plain single header row, and files whose ticker column has no header at all.
    """
    book = pd.read_excel(content, sheet_name=sheet, header=None)
    if isinstance(book, dict):                       # sheet=None -> take the first usable sheet
        book = next(iter(book.values()))
    raw = book.dropna(how="all").dropna(axis=1, how="all")
    raw = raw.set_axis(range(raw.shape[0]), axis=0).set_axis(range(raw.shape[1]), axis=1)

    quarter = None
    header_row = 0
    first = raw.iloc[0].astype(str).str.strip().str.lower()
    if first.iloc[0].startswith("as of end of") or first.str.contains("as of end of").any():
        quarter = parse_quarter(raw.iloc[0].dropna().astype(str).iloc[-1])
        header_row = 1
    # the header is the first row within the first three that names at least two known fields
    for h in range(header_row, min(header_row + 3, len(raw))):
        hits = sum(ALIAS_MAP.get(_norm(v)) is not None for v in raw.iloc[h])
        if hits >= 2:
            header_row = h
            break

    header = raw.iloc[header_row]
    body = raw.iloc[header_row + 1:].reset_index(drop=True)
    cols, seen = {}, set()
    for pos, name in header.items():
        field_name = ALIAS_MAP.get(_norm(name))
        if field_name and field_name not in seen:
            cols[field_name] = pos
            seen.add(field_name)
    if "TICKER" not in cols:
        # some exports leave the ticker column unnamed: take the first mostly-text column
        for pos in body.columns:
            vals = body[pos].dropna().astype(str)
            if len(vals) and (vals.str.contains(r"[A-Za-z]").mean() > 0.9):
                cols["TICKER"] = pos
                break
    missing = [f for f in ("TICKER", "PE", "PB", "PS", "DE", "EPS") if f not in cols]
    if missing:
        raise ValueError(
            "could not find these columns in the file: " + ", ".join(missing)
            + ". Columns read: " + ", ".join(str(v) for v in header.dropna().tolist()[:25]))

    out = pd.DataFrame({name: body[pos] for name, pos in cols.items()})
    out["TICKER"] = out["TICKER"].map(ticker_key)
    for c in [c for c in out.columns if c != "TICKER"]:
        out[c] = pd.to_numeric(out[c].replace(MISSING_STRINGS, np.nan), errors="coerce")
    return out.dropna(subset=["TICKER"]), quarter


def _asof(index: pd.DatetimeIndex, when: pd.Timestamp) -> pd.Timestamp | None:
    pos = index.searchsorted(pd.Timestamp(when), side="right") - 1
    return index[pos] if pos >= 0 else None


def compute_price_factors(prices: pd.DataFrame, industries: dict, quarter: str) -> tuple[pd.DataFrame, dict, list]:
    """prices: long adj_close by (ticker key, trade_date). Returns the five price factors."""
    warnings = []
    wide = prices.pivot(index="trade_date", columns="ticker", values="adj_close").sort_index().astype(float)
    start, end, year_ago = price_window(quarter)
    d_end, d_start, d_year = (_asof(wide.index, d) for d in (end, start, year_ago))
    if d_end is None or d_start is None:
        raise ValueError(f"no prices for the window {start:%Y-%m-%d} to {end:%Y-%m-%d}")
    if (end - d_end).days > 10:
        warnings.append(f"prices stop at {d_end:%Y-%m-%d}, {(end - d_end).days} days before the window end "
                        f"({end:%Y-%m-%d}) - load newer prices for a complete quarter")

    p_end, p_start = wide.loc[d_end], wide.loc[d_start]
    out = pd.DataFrame(index=wide.columns)
    out["Momentum"] = p_end - p_start
    if d_year is not None:
        out["TMR"] = (p_end / wide.loc[d_year] - 1) * 100
    else:
        out["TMR"] = np.nan
        warnings.append("no price 12 months before the window end, so TMR could not be computed")

    if INDEX_TICKER in wide.columns and not np.isnan(wide.loc[d_end, INDEX_TICKER]):
        window = wide.loc[(wide.index >= d_start) & (wide.index <= d_end)]
        returns = window.pct_change().iloc[1:]
        index_returns = returns[INDEX_TICKER]
        index_var = index_returns.var()
        out["Beta"] = returns.apply(lambda col: col.cov(index_returns) / index_var)
        quarter_return = p_end / p_start - 1
        index_return = wide.loc[d_end, INDEX_TICKER] / wide.loc[d_start, INDEX_TICKER] - 1
        out["Alpha"] = quarter_return - (RISK_FREE_QUARTERLY + out["Beta"] * (index_return - RISK_FREE_QUARTERLY))
    else:
        out["Beta"] = out["Alpha"] = np.nan
        warnings.append(f"benchmark '{INDEX_TICKER}' has no price in this window, so Beta and Alpha are blank")

    industry = pd.Series({t: industries.get(t) for t in out.index})
    grouped = p_end.groupby(industry)
    out["Zscore"] = (p_end - grouped.transform("mean")) / grouped.transform("std")
    if industry.isna().any():
        warnings.append(f"{int(industry.isna().sum())} tickers have no industry, so their Zscore is blank")

    window_info = {"quarter_start": None, "window_start": str(d_start.date()), "window_end": str(d_end.date()),
                   "twelve_months_before": None if d_year is None else str(d_year.date()),
                   "requested_window": f"{start:%Y-%m-%d} to {end:%Y-%m-%d}",
                   "trading_days": int(((wide.index >= d_start) & (wide.index <= d_end)).sum())}
    return out, window_info, warnings


def build_factors(raw: pd.DataFrame, prices: pd.DataFrame, industries: dict, quarter: str) -> Result:
    """Combine the uploaded fundamentals with the price factors into the final table."""
    warnings = []
    raw = raw.copy()
    duplicates = raw["TICKER"].duplicated().sum()
    if duplicates:
        warnings.append(f"{duplicates} duplicate tickers in the upload; the first row of each was kept")
        raw = raw.drop_duplicates("TICKER")
    if "DIV_YIELD" in raw and "MA50" in raw and (raw["DIV_YIELD"] == raw["MA50"]).mean() > 0.5:
        warnings.append("the dividend yield column looks like a copy of the 50-day moving average "
                        "(this happened in Raw_Data_Q2FY26.xlsx) - check the export")

    price_factors, window, price_warnings = compute_price_factors(prices, industries, quarter)
    warnings += price_warnings

    df = raw.set_index("TICKER")
    out = pd.DataFrame(index=df.index)
    out["TMR"] = price_factors["TMR"]
    out["Momentum"] = price_factors["Momentum"]
    out["Beta"] = price_factors["Beta"]
    out["Alpha"] = price_factors["Alpha"]
    out["Zscore"] = price_factors["Zscore"]
    with np.errstate(divide="ignore", invalid="ignore"):
        out["EP"] = 1 / df["PE"]
        out["BP"] = 1 / df["PB"]
        out["SP"] = 1 / df["PS"]
    out["Dividend_Flag"] = (df["DIV_YIELD"].fillna(0) > 0).astype(int) if "DIV_YIELD" in df else 0
    out["DE"] = df["DE"]
    out["EPS"] = df["EPS"]
    out = out.replace([np.inf, -np.inf], np.nan).reset_index().rename(columns={"TICKER": "Ticker"})
    out = out[OUTPUT_COLUMNS]

    no_price = out["Momentum"].isna().sum()
    if no_price:
        warnings.append(f"{no_price} tickers in the upload have no price in the database, so their price "
                        f"factors are blank")
    stats = {
        "rows": len(out),
        "with_all_factors": int(out[OUTPUT_COLUMNS[1:]].notna().all(axis=1).sum()),
        "missing_price_factors": int(no_price),
        "missing_by_column": {c: int(out[c].isna().sum()) for c in OUTPUT_COLUMNS[1:]},
        "dividend_payers": int(out["Dividend_Flag"].sum()),
    }
    return Result(quarter=quarter, factors=out, window=window, warnings=warnings, stats=stats)
