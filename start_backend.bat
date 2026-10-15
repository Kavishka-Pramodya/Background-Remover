@echo off
title Product Image Studio Backend
echo Starting Product Image Studio Backend...
echo API docs: http://127.0.0.1:8000/docs
echo Health:   http://127.0.0.1:8000/api/health
echo.
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Backend failed to start.
    pause
)
