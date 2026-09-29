"""Front end: upload a quarter's factor file and get the Bi-LSTM out-of-time predictions."""
import io
import os

import pandas as pd
import streamlit as st

import pipeline

st.set_page_config(page_title="Quant Fund · OOT Predictions", page_icon="📈", layout="wide")


@st.cache_resource(show_spinner="Loading model…")
def get_model():
    return pipeline.load_artifacts()


@st.cache_data(show_spinner="Running predictions…")
def predict(file_bytes):
    model, classes = get_model()
    raw = pipeline.read_input(io.BytesIO(file_bytes))
    return pipeline.run(raw, model, classes)


def to_excel(df):
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    return buf.getvalue()


st.title("Out-of-time predictions")
st.caption(
    f"Bi-LSTM model `{pipeline.MODEL_FILE}` · a ticker is tagged **1** when its predicted "
    f"probability is ≥ {pipeline.THRESHOLD}"
)

uploaded = st.file_uploader("Upload the quarter's input file", type=["xlsx"])
with st.expander("What the file needs"):
    st.write(
        "One row per ticker, first sheet, with these columns: "
        + ", ".join(f"`{c}`" for c in pipeline.REQUIRED_COLUMNS)
        + ". Extra columns are kept in the output."
    )

if uploaded is None:
    st.info("Upload a file like `Q1FY26_as_input_data_22092025.xlsx` to run the predictions.")
    st.stop()

try:
    result, summary = predict(uploaded.getvalue())
except pipeline.InputError as e:
    st.error(str(e))
    st.stop()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Tickers in file", summary.rows_uploaded)
c2.metric("Scored by model", summary.rows_scored)
c3.metric("Predicted 1", summary.predicted_positive)
c4.metric("Missing features", summary.missing_feature_rows,
          help="Rows with a blank feature get no prediction from the model; "
               "as in the notebook, their probability is set to 0 and tag to 0.")

if summary.unknown_tickers:
    with st.expander(f"{len(summary.unknown_tickers)} tickers skipped — the model wasn't trained on them"):
        st.write(", ".join(summary.unknown_tickers))

stem = os.path.splitext(uploaded.name)[0]
st.download_button(
    "Download results (.xlsx)",
    data=to_excel(result),
    file_name=f"Preds_{stem}.xlsx",
    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    type="primary",
)

display_cols = ['Ticker', 'Pred_Prob', 'Pred_Tag'] + [c for c in result.columns
                                                     if c not in ('Ticker', 'Pred_Prob', 'Pred_Tag', 'index')]
ranked = result.sort_values('Pred_Prob', ascending=False)[display_cols]
column_config = {
    "Pred_Prob": st.column_config.ProgressColumn("Pred_Prob", format="%.3f", min_value=0.0, max_value=1.0),
}

tab_pos, tab_all = st.tabs([f"Predicted 1 ({summary.predicted_positive})",
                            f"All scored tickers ({summary.rows_scored})"])
with tab_pos:
    st.dataframe(ranked[ranked['Pred_Tag'] == 1], hide_index=True, use_container_width=True,
                 column_config=column_config)
with tab_all:
    st.dataframe(ranked, hide_index=True, use_container_width=True, column_config=column_config)
