"""Resolve every ticker code seen in the price files to one security (NSE symbol + ISIN).

Order of evidence for a code: ISIN from the price file itself (June 2026 export) or the Investment
Team mapping files -> NSE symbol via the Algo Trading universe, then via the NSE BhavCopy mapping;
failing that, the code itself if it is an NSE symbol with a similar company name; failing that,
a close company-name match. mapping/overrides.csv is applied last and always wins.
Codes that land on the same NSE symbol (renames such as ZOMATO -> ETERNAL, LTIM -> LTM) become one
security with several aliases.
"""
import difflib
import re

import pandas as pd

from config import COMPANY_META_CSV, OVERRIDES_CSV, REFERENCE_DIR, UNIVERSE_CSV
from sources import ISIN_RE, core_code

# (file, sheet, code column, ISIN column, name column); earlier files win when they disagree
REFERENCE_ISIN = [
    ("ISIN Ticker Mapping.xlsx", "Sheet1", "Bloomberg Code", "ISIN", "Name"),
    ("BB Codes and ISIN.xlsx", 0, "Bloomberg Code", "ISIN", None),
    ("ISIN_Ticker_Mapping_openfig.xlsx", 0, "Ticker", "ISIN", "Name"),
    ("ISIN Ticker Mapping - Reshared - Formatted.xlsx", 0, "Ticker", "ISIN", "Stock List"),
]
NSE_BHAVCOPY = "ISIN Ticker Mapping - NSE BhavCopy.xlsx"
REITS = {"EMBASSY", "MINDSPACE", "BIRET", "NXST"}


def _isin(x):
    x = x.strip() if isinstance(x, str) else ""
    return x if ISIN_RE.match(x) else None


def _text(x):
    return x.strip() if isinstance(x, str) and x.strip() and x.strip().lower() != "nan" else None


def norm_name(n):
    n = str(n).lower().replace("&", " and ")
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    n = re.sub(r"\b(ltd|limited|the|co|company|corp|corporation|pvt|private)\b", " ", n)
    return " ".join(n.split())


def _reference():
    isins, names, industry = {}, {}, {}
    for fname, sheet, ccol, icol, ncol in REFERENCE_ISIN:
        df = pd.read_excel(REFERENCE_DIR / fname, sheet_name=sheet, dtype=str)
        for r in df.to_dict("records"):
            code = core_code(r[ccol])
            if not code:
                continue
            i = _isin(r[icol])
            if i and i not in isins.setdefault(code, []):
                isins[code].append(i)
            if ncol and _text(r[ncol]):
                names.setdefault(code, _text(r[ncol]))
            if _text(r.get("Industry")):
                industry.setdefault(code, _text(r["Industry"]))
    bhav = pd.read_excel(REFERENCE_DIR / NSE_BHAVCOPY, sheet_name="Sheet1", dtype=str)
    bhav = {_isin(i): t.strip() for i, t in zip(bhav["ISIN"], bhav["Ticker"])
            if _isin(i) and _text(t) and t.strip() != "0"}
    return isins, names, industry, bhav


def _sec_type(symbol, name, isin, raw_labels):
    n = (name or "").upper()
    if any(str(l).upper().endswith("INDEX") for l in raw_labels):
        return "index"
    if symbol in REITS or "REIT" in n:
        return "reit"
    if "INVIT" in n or "TRUST" in n or symbol.endswith("INVIT"):
        return "invit"
    if (isin or "").startswith("INF") or "ETF" in n or "BEES" in n:
        return "etf"
    return "equity"


def build_master(labels, last_seen):
    """labels: file, file_end, code, raw, name, isin (one row per code per file).
    last_seen: code -> last date with a price.

    Returns securities, aliases, code_map (code -> symbol, how) and review rows.
    """
    ref_isins, ref_names, ref_industry, bhav = _reference()
    uni = pd.read_csv(UNIVERSE_CSV, dtype=str)
    uni_by_isin = dict(zip(uni["isin"], uni["symbol"]))
    uni_name = dict(zip(uni["symbol"], uni["name"]))
    uni_isin = dict(zip(uni["symbol"], uni["isin"]))
    uni_norm = {}
    for s, n in uni_name.items():
        uni_norm.setdefault(norm_name(n), s)
    meta = pd.read_csv(COMPANY_META_CSV, dtype=str)
    meta_industry = dict(zip(meta["symbol"], meta["industry"]))
    overrides = {core_code(r["code"]): r for r in pd.read_csv(OVERRIDES_CSV, dtype=str).fillna("").to_dict("records")}

    rows = []
    for code, g in labels.sort_values("file_end", ascending=False).groupby("code", sort=False):
        name = next((n for n in g["name"] if _text(n)), None) or ref_names.get(code)
        isins = list(dict.fromkeys([i for i in g["isin"] if _isin(i)] + ref_isins.get(code, [])))
        # partly-paid rights shares (ISIN IN9...) trade at their own price: never fold them into the parent
        partly_paid = any(i.startswith("IN9") for i in isins)
        symbol, how = None, None
        for i in isins:
            if i in uni_by_isin:
                symbol, how = uni_by_isin[i], "isin"
                break
        if not symbol:
            symbol, how = next(((bhav[i], "isin-bhavcopy") for i in isins if i in bhav), (None, None))
        if not symbol and not partly_paid and code in uni_name and name and \
                difflib.SequenceMatcher(None, norm_name(name), norm_name(uni_name[code])).ratio() > 0.6:
            symbol, how = code, "code"
        if not symbol and not partly_paid and name:
            m = difflib.get_close_matches(norm_name(name), list(uni_norm), n=1, cutoff=0.9)
            if m:
                symbol, how = uni_norm[m[0]], "name"
        o = overrides.get(code)
        if o and o["symbol"]:
            symbol, how = o["symbol"].strip().upper(), "override"
        if o and o["isin"]:
            isins = [o["isin"].strip()] + [i for i in isins if i != o["isin"].strip()]
        rows.append(dict(code=code, symbol=symbol or code, resolved=bool(symbol),
                         how=how or ("partly-paid" if partly_paid else "unresolved"),
                         isins=isins, name=name, raw=list(g["raw"].dropna()), last_seen=last_seen.get(code),
                         industry=ref_industry.get(code), sec_type=(o or {}).get("sec_type") or None))
    codes = pd.DataFrame(rows)

    # an unresolved code must not take over another security's NSE symbol
    clash = ~codes["resolved"] & codes["symbol"].isin(set(codes.loc[codes["resolved"], "symbol"]))
    codes.loc[clash, "symbol"] = codes.loc[clash, "symbol"] + "_BBG"

    secs, aliases, review = [], [], []
    for sym, g in codes.sort_values("last_seen", ascending=False).groupby("symbol", sort=False):
        top = g.iloc[0]
        isin = uni_isin.get(sym) or (top["isins"][0] if top["isins"] else None)
        name = top["name"] or uni_name.get(sym)
        secs.append(dict(
            symbol=sym, isin=isin, name=name, bbg_code=top["code"],
            industry=next((x for x in g["industry"] if x), None) or meta_industry.get(sym),
            sec_type=next((x for x in g["sec_type"] if x), None) or _sec_type(sym, name, isin, sum(g["raw"], [])),
            matched_by=",".join(sorted(set(g["how"]))), codes=" ".join(g["code"])))
        aliases += [(c, "bbg", sym) for c in g["code"]]
        for i in dict.fromkeys(i for lst in g["isins"] for i in lst):
            if i == isin:
                continue
            if isin and i[:7] != isin[:7]:  # different issuer, not just a post-split ISIN
                review.append(dict(symbol=sym, issue="isin_mismatch",
                                   detail=f"mapping files also give {i} for {' '.join(g['code'])}; current ISIN {isin}"))
                continue
            aliases.append((i, "isin", sym))
            if bhav.get(i) and bhav[i] != sym:
                aliases.append((bhav[i], "nse", sym))
        if set(g["how"]) == {"unresolved"}:
            review.append(dict(symbol=sym, issue="no_nse_symbol",
                               detail=f"{top['code']} ({name}) is not in the current NSE equity list (delisted/merged, "
                                      f"ETF, InvIT or SME?); kept under its Bloomberg code, no gap-filling"))

    secs = pd.DataFrame(secs)
    dup = secs["isin"].notna() & secs.duplicated("isin", keep="first")
    for r in secs[dup].itertuples():
        review.append(dict(symbol=r.symbol, issue="duplicate_isin", detail=f"ISIN {r.isin} already used by another security"))
    secs.loc[dup, "isin"] = None

    aliases = pd.DataFrame(aliases, columns=["alias", "kind", "symbol"])
    aliases = aliases[~(aliases["kind"].eq("isin") & aliases["alias"].isin(set(secs["isin"].dropna())))]
    aliases = aliases.drop_duplicates(["alias", "kind"])
    code_map = codes.set_index("code")[["symbol", "how"]]
    return secs, aliases, code_map, review
