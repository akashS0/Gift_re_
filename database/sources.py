"""Readers for the raw price files: the Bloomberg Excel exports and the Algo Trading parquet files."""
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

from config import EXCEL_DIR, OUTPUT_DIR, PARQUET_DIR

ISIN_RE = re.compile(r"^IN[A-Z0-9]{10}$")
EXCEL_CACHE = OUTPUT_DIR / "cache_excel_prices.parquet"
LABELS_CACHE = OUTPUT_DIR / "cache_excel_labels.parquet"


def core_code(label):
    """'RELIANCE IN Equity ' / 'Reliance' / 'KRB IN' / 'NSEMCAP Index' -> 'RELIANCE' / 'RELIANCE' / 'KRB' / 'NSEMCAP'."""
    if label is None or pd.isna(label):
        return None
    t = str(label).strip().upper().split()
    while t and t[-1] in ("EQUITY", "INDEX"):
        t.pop()
    if len(t) > 1 and t[-1] == "IN":
        t.pop()
    return " ".join(t) or None


def _is_date(v):
    return hasattr(v, "year") and not isinstance(v, str) and not pd.isna(v)


def _classify(values):
    """What a header row/column holds: 'isin', 'code', 'name', or None (numbers, blanks)."""
    vals = [str(v).strip() for v in values if not pd.isna(v) and str(v).strip()]
    if not vals:
        return None
    share = lambda test: sum(map(test, vals)) / len(vals)
    if share(lambda v: bool(ISIN_RE.match(v))) > 0.8:
        return "isin"
    if share(lambda v: v.replace(".", "", 1).isdigit()) > 0.8:
        return None
    if share(lambda v: bool(re.search(r"\s(IN|Equity|Index)$", v, re.I))) > 0.5:
        return "code"
    if share(lambda v: " " not in v) > 0.9:
        return "code"  # bare short codes like 'Swe' / 'dlfu'
    return "name"


def _parse_sheet(raw):
    """One sheet -> (prices: code/date/close, labels: code/raw/name/isin).

    Handles both orientations seen in the exports: securities down the rows with dates across a
    header row, or dates down the first column with one column per security. Header rows/columns
    (Bloomberg code, company name, ISIN, internal ids) are recognised by their content.
    """
    raw = raw.dropna(how="all").dropna(axis=1, how="all")
    raw = raw.set_axis(range(raw.shape[0]), axis=0).set_axis(range(raw.shape[1]), axis=1)
    col0 = raw[0].map(_is_date)
    if col0.mean() > 0.5:
        first = int(col0.idxmax())
        is_row = col0.to_numpy() & (np.arange(len(raw)) >= first)
        fields = [raw.iloc[i, 1:].tolist() for i in range(first)]
        dates = pd.to_datetime(raw.loc[is_row, 0].tolist())
        vals = raw.loc[is_row, 1:].apply(pd.to_numeric, errors="coerce").to_numpy(float).T
    else:
        h = next((h for h in range(min(6, len(raw))) if raw.iloc[h].map(_is_date).sum() >= 3), None)
        if h is None:
            raise ValueError("no date header row or date column")
        is_col = raw.iloc[h].map(_is_date).to_numpy()
        dcol = int(is_col.argmax())
        fields = [raw.iloc[h + 1:, j].tolist() for j in range(dcol)]
        dates = pd.to_datetime(raw.iloc[h, is_col].tolist())
        vals = raw.iloc[h + 1:, is_col].apply(pd.to_numeric, errors="coerce").to_numpy(float)

    info = {}
    for f in fields:
        kind = _classify(f)
        if kind and kind not in info:
            info[kind] = f
    if "code" not in info:
        raise ValueError("no ticker row/column found")
    n = len(info["code"])
    labels = pd.DataFrame({
        "code": [core_code(v) for v in info["code"]],
        "raw": [None if pd.isna(v) else str(v).strip() for v in info["code"]],
        "name": [None if pd.isna(v) else str(v).strip() for v in info.get("name", [None] * n)],
        "isin": [str(v).strip() if isinstance(v, str) and ISIN_RE.match(v.strip()) else None
                 for v in info.get("isin", [None] * n)],
    })
    codes = labels["code"].to_numpy(object)
    r, c = np.nonzero(np.isfinite(vals) & (vals > 0))
    prices = pd.DataFrame({"code": codes[r], "date": dates.normalize()[c], "close": vals[r, c]})
    return prices[prices["code"].notna()], labels[labels["code"].notna()]


def _fingerprint(files):
    return [[f.name, f.stat().st_size, int(f.stat().st_mtime)] for f in files]


def read_excel_prices(folder=EXCEL_DIR):
    """All Excel exports as long rows (code, date, close, file) plus the header labels per file.

    Parsing the 25 MB history file takes about a minute, so the result is cached in output/
    and reused until any Excel file changes.
    """
    files = sorted(f for f in Path(folder).glob("*.xlsx") if not f.name.startswith("~$"))
    meta = OUTPUT_DIR / "cache_excel_files.json"
    if EXCEL_CACHE.exists() and meta.exists() and json.loads(meta.read_text()) == _fingerprint(files):
        print("  Excel files unchanged, using cache")
        return pd.read_parquet(EXCEL_CACHE), pd.read_parquet(LABELS_CACHE)

    parts, label_parts = [], []
    for path in files:
        for sheet, raw in pd.read_excel(path, sheet_name=None, header=None).items():
            try:
                prices, labels = _parse_sheet(raw)
            except ValueError as e:
                print(f"  skipped {path.name} [{sheet}]: {e}")
                continue
            prices["file"] = path.name
            labels["file"] = path.name
            parts.append(prices)
            label_parts.append(labels)
            print(f"  {path.name} [{sheet}]: {labels['code'].nunique():,} tickers, {len(prices):,} prices, "
                  f"{prices['date'].min():%Y-%m-%d} to {prices['date'].max():%Y-%m-%d}")
    xl = pd.concat(parts, ignore_index=True)
    # the same sheet can be duplicated inside a file (December, March); keep one copy
    xl = xl.drop_duplicates(["file", "code", "date"]).reset_index(drop=True)
    xl["code"] = xl["code"].astype("category")
    xl["file"] = xl["file"].astype("category")
    labels = pd.concat(label_parts, ignore_index=True).drop_duplicates()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    xl.to_parquet(EXCEL_CACHE, index=False)
    labels.to_parquet(LABELS_CACHE, index=False)
    meta.write_text(json.dumps(_fingerprint(files)))
    return xl, labels


def read_parquet_prices(folder=PARQUET_DIR):
    """Every per-symbol parquet file as long rows (symbol, date, close). `close` is split/bonus-adjusted."""
    parts = []
    for p in sorted(Path(folder).glob("*.parquet")):
        d = pd.read_parquet(p, columns=["date", "close"])
        d["symbol"] = p.stem
        parts.append(d)
    pq = pd.concat(parts, ignore_index=True).dropna()
    pq = pq[pq["close"] > 0]
    pq["date"] = pd.to_datetime(pq["date"]).dt.normalize()
    pq["symbol"] = pq["symbol"].astype("category")
    return pq.drop_duplicates(["symbol", "date"]).reset_index(drop=True)
