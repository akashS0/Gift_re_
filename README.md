# Quant Fund App

The project website, the model-scoring service, the Supabase loaders and the trained models in one place.

## Start it

Double-click `start_portal.bat`. It opens two windows (the API and the website) and then
<http://localhost:8000> in your browser.

- **Project details**: the portal home page (sections 01–06, Model A, Model B, evidence base).
- **Check outputs**: Model A → *05 Check outputs*, or <http://localhost:8000/check-outputs/>.
  - A quarter saved in Supabase (Q4FY05 to Q4FY26) shows every stock's probability, rank, Top 30 flag, target,
    current and next quarter price (60-day lag) and return.
  - For any other quarter, upload its base data to run the model. The output has no prices or returns,
    because those aren't known yet. You can save it to Supabase from the page.
- **Factor builder**: <http://localhost:8000/factor-builder/> turns a raw Bloomberg export into model inputs.

`run_streamlit.bat` starts the simpler single-page prediction app on <http://localhost:8501>.

## Folder layout

| Folder | What's in it |
|---|---|
| `frontend/` | The website (git repo `sdaistudio/gift-re-portal`, published on GitHub Pages). Edit `src/App.jsx`, then `npm run build`. |
| `api/` | The local scoring service used by the Check outputs and Factor builder pages (`python api/main.py`). |
| `database/` | Price database build and Supabase loaders. `load_outputs.py` loads a Stockwise sheet into `model_outputs`. |
| `models/` | The trained models: Bi-LSTM (production), CNN, LSTM, TFT, Logistic Regression. |
| `data/inputs/` | The final supporting workbook (`29Sep - Supporting working file - Updated.xlsx`) and the index returns workbook. |
| `data/outputs/` | Quarter prediction files with prices, returns and targets added. |
| `app.py`, `pipeline.py` | Streamlit app and the shared scoring pipeline. |
| `.env` | Supabase connection string. Keep it private; it is never committed. |

## Updating Supabase with a new workbook

```
.venv\Scripts\python.exe database\load_outputs.py "data\inputs\<workbook>.xlsx"
```

The workbook's `Stockwise` sheet is stored exactly as it is (rank, Top 30 Flag, prices, return). Each quarter in the
file replaces what the table held for that quarter; other quarters are left alone.

## Setup on a new machine

```
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt fastapi uvicorn python-multipart
```
