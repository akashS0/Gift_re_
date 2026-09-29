@echo off
rem Starts the Streamlit prediction app on http://localhost:8501
cd /d "%~dp0"
".venv\Scripts\python.exe" -m streamlit run app.py
pause
