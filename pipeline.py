"""Out-of-time prediction pipeline from `oot_preds copy.ipynb`, packaged for the app."""
import os
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy.stats import boxcox
from sklearn.preprocessing import LabelEncoder, PowerTransformer, StandardScaler

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
MODEL_FILE = "bi_lstm_top200_xform_16qtr.keras"
ENCODER_FILE = "bi_lstm_top200_xform_label_encoder_16qtr.npy"
THRESHOLD = 0.5

# list of params being used in modelling (order matters: it is the model's input order)
SIGN_FEAT = ['TMR', 'Momentum', 'Beta', 'Alpha', 'Zscore', 'EP', 'BP', 'SP', 'Dividend_Flag', 'DE', 'EPS']

BEST_TRANSFORMS = {'TMR': 'yeo-johnson',
                   'Momentum': 'yeo-johnson',
                   'Beta': 'yeo-johnson',
                   'Alpha': 'yeo-johnson',
                   'EP': 'boxcox',
                   'BP': 'yeo-johnson',
                   'SP': 'boxcox',
                   'Dividend_Flag': 'original',
                   'DE': 'yeo-johnson',
                   'EPS': 'yeo-johnson',
                   'Zscore': 'yeo-johnson'}

REQUIRED_COLUMNS = ['Ticker'] + SIGN_FEAT
# columns the pipeline itself creates; dropped from uploads so a previous output file can be re-run
OUTPUT_COLUMNS = ['index', 'Ticker_Encoded', 'Pred_Tag', 'Pred_Prob']


class InputError(ValueError):
    """The uploaded file can't be used as model input."""


@dataclass
class Summary:
    rows_uploaded: int
    rows_scored: int
    predicted_positive: int
    missing_feature_rows: int
    unknown_tickers: list = field(default_factory=list)


def load_artifacts(model_dir=MODEL_DIR):
    import tensorflow as tf  # heavy; only needed once the app actually predicts

    model = tf.keras.models.load_model(os.path.join(model_dir, MODEL_FILE))
    classes = np.load(os.path.join(model_dir, ENCODER_FILE), allow_pickle=True)
    return model, classes


def read_input(source):
    try:
        df = pd.read_excel(source)
    except Exception as e:
        raise InputError(f"Couldn't read the Excel file: {e}") from e

    df = df.drop(columns=[c for c in df.columns if c in OUTPUT_COLUMNS or str(c).startswith('Unnamed:')])
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise InputError(f"The file is missing required column(s): {', '.join(missing)}")
    return df


def transform_feature(x, method):
    if method == 'yeo-johnson':
        pt = PowerTransformer(method='yeo-johnson')
        return pt.fit_transform(x.values.reshape(-1, 1)).flatten()
    elif method == 'boxcox':
        # Box-Cox requires strictly positive values
        # Add a small constant if min(x) == 0
        x_pos = x.copy()
        if (x_pos <= 0).any():
            x_pos = x_pos - x_pos.min() + 1e-6
        return boxcox(x_pos)[0]
    elif method == 'log1p':
        x_pos = x.copy()
        if (x_pos < 0).any():
            x_pos = x_pos - x_pos.min() + 1e-6
        return np.log1p(x_pos)
    else:
        return x.values


def run(df_raw, model, classes, threshold=THRESHOLD):
    df = df_raw.copy()
    df[SIGN_FEAT] = df[SIGN_FEAT].apply(pd.to_numeric, errors='coerce')
    df.replace([np.inf, -np.inf], 0, inplace=True)
    df['EP'] = df['EP'].fillna(0)
    df['SP'] = df['SP'].fillna(0)

    # filtering out unknown labels - that were not trained by encoder
    known = df['Ticker'].isin(classes)
    unknown_tickers = df.loc[~known, 'Ticker'].astype(str).tolist()
    df2 = df[known].reset_index(drop=False)
    if df2.empty:
        raise InputError("None of the tickers in the file are known to the model.")

    df_trans = df2.copy()
    for col in SIGN_FEAT:
        method = BEST_TRANSFORMS.get(col, 'none')
        if method != 'none':
            df_trans[col] = transform_feature(df2[col], method)

    # The notebook loads the saved scaler but calls fit_transform, which refits it on this
    # file's data - equivalent to a fresh StandardScaler, so the pickle's stats are unused.
    X = StandardScaler().fit_transform(df_trans[SIGN_FEAT])

    label_encoder = LabelEncoder()
    label_encoder.classes_ = classes
    df2['Ticker_Encoded'] = label_encoder.transform(df2['Ticker'])

    pred_probs = model.predict([df2['Ticker_Encoded'].values, X], verbose=0).reshape(-1)
    missing_feature_rows = int(np.isnan(pred_probs).sum())

    df2['Pred_Tag'] = (pred_probs >= threshold).astype(int)
    df2['Pred_Prob'] = np.nan_to_num(pred_probs, nan=0.0)

    summary = Summary(
        rows_uploaded=len(df),
        rows_scored=len(df2),
        predicted_positive=int(df2['Pred_Tag'].sum()),
        missing_feature_rows=missing_feature_rows,
        unknown_tickers=unknown_tickers,
    )
    return df2, summary
