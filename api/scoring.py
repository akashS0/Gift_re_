"""Score a quarter's factor table with any of the trained models.

Same steps as `oot_preds copy.ipynb` (and `pipeline.py`, which this reuses): transform each feature
with its chosen power transform, standard-scale the batch, encode the ticker, then predict.

All five models take the 11 features in the order `pipeline.SIGN_FEAT`, and every neural one also
takes the encoded ticker; they differ only in the shape they expect:

    bi_lstm, cnn   (n, 11)        lstm  (n, 11, 1)        tft  (n, 1, 11)        lr  (n, 11), no ticker

Rows whose features are incomplete are left unscored rather than fed to the model as NaN - keras
returns NaN for them anyway, and scikit-learn refuses them outright.
"""
from __future__ import annotations

import os
import pickle
import sys
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import pipeline  # noqa: E402  (SIGN_FEAT, BEST_TRANSFORMS, transform_feature, THRESHOLD)

MODEL_DIRS = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models"),
]
ENCODER_FILE = "bi_lstm_top200_xform_label_encoder_16qtr.npy"

DESCRIPTIONS = {
    "bi_lstm_top200_xform_16qtr.keras": ("Bi-LSTM (16 quarter)", "The production model; the Streamlit app uses this one."),
    "cnn_top200_xform.keras": ("CNN", "Convolutional network over the same 11 features."),
    "lstm_top200_xform.keras": ("LSTM", "Single-direction LSTM."),
    "tft_top200.keras": ("Temporal Fusion Transformer", "Attention-based model, the largest of the five."),
    "lr_top200_xform.pkl": ("Logistic Regression", "Linear baseline; no ticker embedding."),
}
_CACHE: dict[str, tuple] = {}


@dataclass
class Prediction:
    frame: pd.DataFrame
    summary: dict = field(default_factory=dict)


def _dirs():
    return [d for d in MODEL_DIRS if os.path.isdir(d)]


def list_models() -> list[dict]:
    """Every model file we can find, newest-looking first, with a friendly name."""
    found, seen = [], set()
    for d in _dirs():
        for f in sorted(os.listdir(d)):
            if not f.endswith((".keras", ".pkl")) or f in seen or "scaler" in f or "encoder" in f:
                continue
            seen.add(f)
            name, note = DESCRIPTIONS.get(f, (f, ""))
            found.append({"id": f, "name": name, "note": note,
                          "kind": "keras" if f.endswith(".keras") else "sklearn",
                          "size_mb": round(os.path.getsize(os.path.join(d, f)) / 1e6, 1),
                          "folder": d})
    order = list(DESCRIPTIONS)
    found.sort(key=lambda m: order.index(m["id"]) if m["id"] in order else 99)
    return found


def _find(filename: str) -> str:
    for d in _dirs():
        p = os.path.join(d, filename)
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f"{filename} is not in any model folder")


def load_model(model_id: str):
    """(model object, kind, expected continuous-input shape, encoder classes or None), cached."""
    if model_id in _CACHE:
        return _CACHE[model_id]
    path = _find(model_id)
    if model_id.endswith(".keras"):
        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
        import tensorflow as tf
        model = tf.keras.models.load_model(path)
        shapes = [tuple(i.shape) for i in model.inputs]
        uses_ticker = len(model.inputs) > 1
        cont_shape = shapes[1] if uses_ticker else shapes[0]
        classes = np.load(_find(ENCODER_FILE), allow_pickle=True) if uses_ticker else None
        entry = (model, "keras", cont_shape, classes)
    else:
        with open(path, "rb") as fh:
            model = pickle.load(fh)
        entry = (model, "sklearn", (None, len(pipeline.SIGN_FEAT)), None)
    _CACHE[model_id] = entry
    return entry


def prepare_features(factors: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray]:
    """pipeline.py's preparation: inf -> 0, EP/SP blanks -> 0, power transforms, standard scaling."""
    df = factors.copy()
    df[pipeline.SIGN_FEAT] = df[pipeline.SIGN_FEAT].apply(pd.to_numeric, errors="coerce")
    df = df.replace([np.inf, -np.inf], 0)
    df["EP"] = df["EP"].fillna(0)
    df["SP"] = df["SP"].fillna(0)

    transformed = df.copy()
    for col in pipeline.SIGN_FEAT:
        method = pipeline.BEST_TRANSFORMS.get(col, "none")
        if method != "none":
            transformed[col] = pipeline.transform_feature(df[col], method)
    # the notebook refits the scaler on the batch it is scoring, so the saved pickle goes unused
    scaled = StandardScaler().fit_transform(transformed[pipeline.SIGN_FEAT].fillna(0))
    return df, np.where(transformed[pipeline.SIGN_FEAT].notna().to_numpy(), scaled, np.nan)


def predict(factors: pd.DataFrame, model_id: str, threshold: float = pipeline.THRESHOLD,
            top_n: int = 30) -> Prediction:
    # a factor blank for (almost) every stock can't be power-transformed - scipy raises a BracketError
    values = factors[pipeline.SIGN_FEAT].apply(pd.to_numeric, errors="coerce")
    empty = [c for c in pipeline.SIGN_FEAT if c not in ("EP", "SP") and values[c].notna().sum() < 2]
    if empty:
        why = (" Beta and Alpha need NIFTY Midcap 100 prices across the quarter's price window, and those "
               "are only available up to 29 May 2026." if {"Beta", "Alpha"} & set(empty) else "")
        raise ValueError(f"{', '.join(empty)} could not be calculated for any stock, so this quarter can't be "
                         f"scored yet.{why} If the file is for an earlier quarter, pick that quarter and upload again.")
    model, kind, cont_shape, classes = load_model(model_id)
    df, X = prepare_features(factors)

    known = pd.Series(True, index=df.index)
    unknown_tickers = []
    if classes is not None:
        known = df["Ticker"].isin(classes)
        unknown_tickers = sorted(df.loc[~known, "Ticker"].astype(str))
    complete = pd.Series(np.isfinite(X).all(axis=1), index=df.index)
    usable = known & complete
    if not usable.any():
        raise ValueError("no rows can be scored: every row either has missing factors or a ticker "
                         "the model was never trained on")

    Xu = X[usable.to_numpy()]
    if kind == "keras":
        target = tuple(d for d in cont_shape[1:])
        Xu = Xu.reshape((len(Xu),) + target)          # (n, 11) / (n, 11, 1) / (n, 1, 11)
        encoder = LabelEncoder()
        encoder.classes_ = classes
        codes = encoder.transform(df.loc[usable, "Ticker"])
        probs = model.predict([codes, Xu], verbose=0).reshape(-1)
        df.loc[usable, "Ticker_Encoded"] = codes
    else:
        probs = model.predict_proba(Xu)[:, 1]

    out = df.copy()
    out["Pred_Prob"] = np.nan
    out.loc[usable, "Pred_Prob"] = probs
    out["Pred_Tag"] = (out["Pred_Prob"] >= threshold).astype("Int64")
    out["Rank"] = out["Pred_Prob"].rank(ascending=False, method="dense").astype("Int64")
    out["In_Top_N"] = (out["Rank"] <= top_n).fillna(False).astype(int)

    summary = {
        "model": model_id,
        "model_name": DESCRIPTIONS.get(model_id, (model_id, ""))[0],
        "threshold": threshold,
        "top_n": top_n,
        "rows": int(len(out)),
        "scored": int(usable.sum()),
        "not_scored_missing_factors": int((~complete).sum()),
        "not_scored_unknown_ticker": int((~known).sum()),
        "predicted_positive": int((out["Pred_Tag"] == 1).sum()),
        "mean_probability": float(np.nanmean(out["Pred_Prob"])) if usable.any() else None,
        "unknown_tickers": unknown_tickers[:50],
    }
    return Prediction(frame=out, summary=summary)
