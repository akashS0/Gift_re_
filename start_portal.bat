@echo off
rem Starts the Quant Fund portal: the scoring API (port 8100) and the website (port 8000), then opens it.
cd /d "%~dp0"
start "Quant Fund API" cmd /k ".venv\Scripts\python.exe api\main.py"
start "Quant Fund website" cmd /k ".venv\Scripts\python.exe -m http.server 8000 --bind 127.0.0.1 --directory frontend"
timeout /t 5 /nobreak >nul
start "" http://localhost:8000
