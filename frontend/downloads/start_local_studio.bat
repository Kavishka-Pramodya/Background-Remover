@echo off
title Aura E-Commerce - Local AI Studio Engine
color 0A
cls
echo ===================================================================
echo       AURA E-COMMERCE: LOCAL AI PRODUCT STUDIO ENGINE
echo ===================================================================
echo.
echo  Starting local AI companion for your online store...
echo  Local API: http://127.0.0.1:8000
echo  Web Store: https://background-remover-frontend-delta.vercel.app/
echo.
echo  [Key Advantages]
echo  - 100%% FREE forever (No expensive cloud hosting / zero server costs)
echo  - Unlimited high-resolution product photos
echo  - No memory limits or timeouts (Powered by your own PC CPU/GPU)
echo.
echo ===================================================================
echo.

cd /d "%~dp0"

REM 1. Check Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python 3.10 or newer from https://www.python.org/downloads/
    echo (Make sure to check "Add Python to PATH" during installation)
    echo.
    pause
    exit /b 1
)

REM 2. Check if backend folder exists. If not, auto-download from GitHub.
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

REM 3. Ensure dependencies are installed
echo [1/2] Verifying Python AI dependencies...
python -c "import fastapi, uvicorn, rembg, PIL" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installing required packages (this only takes a moment on first run)...
    pip install -r requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install requirements. Please run: pip install -r requirements.txt
        pause
        exit /b 1
    )
)

REM 4. Launch Local AI Engine
echo.
echo [2/2] Starting Local AI Server on http://127.0.0.1:8000 ...
echo Keep this window open while processing product images in Aura Store!
echo.
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [NOTICE] Server stopped.
    pause
)
