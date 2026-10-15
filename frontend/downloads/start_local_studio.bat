@echo off
title Aura E-Commerce - Local AI Studio Engine
color 0A
cls

cd /d "%~dp0"

echo ===================================================================
echo       AURA E-COMMERCE: LOCAL AI PRODUCT STUDIO ENGINE
echo ===================================================================
echo.
echo  Local API:  http://127.0.0.1:8000
echo  Web Store:  https://background-remover-frontend-delta.vercel.app/
echo.

REM Check if environment is already installed (One-time setup verification)
if exist ".installed" (
    if exist "venv\Scripts\python.exe" (
        goto :FAST_LAUNCH
    )
)

echo ===================================================================
echo       ONE-TIME ENGINE SETUP (This only happens on first launch)
echo ===================================================================
echo.

REM 1. Check Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in your Windows PATH.
    echo Please install Python 3.10 or newer from https://www.python.org/downloads/
    echo (Make sure to check "Add Python to PATH" during installation!)
    echo.
    pause
    exit /b 1
)

REM 2. Check if backend folder exists. If not, auto-download from repository
if not exist "backend\main.py" (
    echo [INFO] Backend engine not detected in current folder.
    echo Downloading lightweight AI engine from repository...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/Kavishka-Pramodya/Background-Remover/archive/refs/heads/main.zip' -OutFile 'aura_engine_repo.zip'"
    if exist "aura_engine_repo.zip" (
        echo Extracting engine files...
        powershell -Command "Expand-Archive -Path 'aura_engine_repo.zip' -DestinationPath 'temp_extract' -Force"
        xcopy /s /e /y "temp_extract\Background-Remover-main\backend" "backend\" >nul
        copy /y "temp_extract\Background-Remover-main\requirements.txt" "requirements.txt" >nul
        rmdir /s /q "temp_extract"
        del /f /q "aura_engine_repo.zip"
        echo [OK] Engine downloaded successfully!
    ) else (
        echo [ERROR] Failed to download backend files.
        pause
        exit /b 1
    )
)

REM 3. Create isolated virtual environment
echo [1/2] Setting up dedicated Python virtual environment (venv)...
if not exist "venv\Scripts\python.exe" (
    python -m venv venv
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to create virtual environment. Please ensure Python 3.10+ is installed.
        pause
        exit /b 1
    )
)

REM 4. Install dependencies into virtual environment
echo [2/2] Installing required AI packages into venv (first-time only)...
.\venv\Scripts\python.exe -m pip install --upgrade pip >nul 2>&1
.\venv\Scripts\pip.exe install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

REM Mark installation as complete
echo installed > .installed
echo.
echo ===================================================================
echo [SUCCESS] Engine installed permanently!
echo Every future launch will now start in less than 1 second (no re-install).
echo ===================================================================
echo.

:FAST_LAUNCH
echo [OK] Dedicated AI environment detected.
echo Starting Local AI Server on http://127.0.0.1:8000 ...
echo Opening Aura Storefront in your browser...
echo.
echo Keep this window open while processing product images in Aura Store!
echo.

start "" "https://background-remover-frontend-delta.vercel.app/"
.\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [NOTICE] Server stopped or encountered an error.
    pause
)
