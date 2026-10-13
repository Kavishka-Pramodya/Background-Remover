@echo off
title Aura Store - Local AI Studio Engine
color 0A
cls
echo ===================================================================
echo     AURA E-COMMERCE - LOCAL AI PRODUCT IMAGE STUDIO ENGINE
echo ===================================================================
echo.
echo  Starting local AI background removal engine on your machine...
echo  URL: http://127.0.0.1:8000
echo.
echo  [Benefits]
echo  - 100%% Free forever (Zero cloud hosting bills)
echo  - Unlimited product photos for your store
echo  - Super-fast processing powered by your own CPU/GPU
echo.
echo ===================================================================
echo.

cd /d "%~dp0"

REM Launch python uvicorn on port 8000
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Could not start backend.
    echo Please make sure Python 3.10+ is installed and requirements are installed:
    echo pip install -r requirements.txt
    echo.
    pause
)
pause
