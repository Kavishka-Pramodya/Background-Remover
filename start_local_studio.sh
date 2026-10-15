#!/usr/bin/env bash
# ===================================================================
#   AURA E-COMMERCE: LOCAL AI PRODUCT STUDIO ENGINE (macOS / Linux)
# ===================================================================

cd "$(dirname "$0")" || exit 1

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}===================================================================${NC}"
echo -e "${GREEN}      AURA E-COMMERCE: LOCAL AI PRODUCT STUDIO ENGINE (macOS)${NC}"
echo -e "${GREEN}===================================================================${NC}"
echo ""
echo -e "Local API:  ${BLUE}http://127.0.0.1:8000${NC}"
echo -e "Web Store:  ${BLUE}https://background-remover-frontend-delta.vercel.app/${NC}"
echo ""

# Check if environment is already installed (One-time setup verification)
if [ -f ".installed" ] && [ -f "venv/bin/python" ]; then
    echo -e "${GREEN}[OK] Dedicated AI environment detected.${NC}"
    echo -e "Starting Local AI Server on ${BLUE}http://127.0.0.1:8000${NC} ..."
    echo "Opening Aura Storefront in your browser..."
    echo ""
    open "https://background-remover-frontend-delta.vercel.app/" 2>/dev/null || xdg-open "https://background-remover-frontend-delta.vercel.app/" 2>/dev/null &
    ./venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
    exit 0
fi

echo -e "${YELLOW}===================================================================${NC}"
echo -e "${YELLOW}      ONE-TIME ENGINE SETUP (This only happens on first launch)${NC}"
echo -e "${YELLOW}===================================================================${NC}"
echo ""

# 1. Check Python 3
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo -e "${RED}[ERROR] Python 3 is not installed on this machine.${NC}"
    echo "Please install Python 3.10+ from https://www.python.org/downloads/ or via Homebrew (brew install python)."
    read -p "Press Enter to exit..."
    exit 1
fi

echo -e "Using Python: $($PYTHON_CMD --version)"

# 2. Check if backend folder exists
if [ ! -f "backend/main.py" ]; then
    echo -e "${YELLOW}[INFO] Backend engine not detected in current folder.${NC}"
    echo "Downloading lightweight AI engine from repository..."
    if command -v curl &> /dev/null; then
        curl -L -o aura_engine_repo.zip "https://github.com/Kavishka-Pramodya/Background-Remover/archive/refs/heads/main.zip"
        if [ -f "aura_engine_repo.zip" ]; then
            echo "Extracting engine files..."
            unzip -q aura_engine_repo.zip -d temp_extract
            cp -r temp_extract/Background-Remover-main/backend .
            cp temp_extract/Background-Remover-main/requirements.txt .
            rm -rf temp_extract aura_engine_repo.zip
            echo -e "${GREEN}[OK] Engine downloaded successfully!${NC}"
        fi
    else
        echo -e "${RED}[ERROR] curl not found. Please download repository zip manually.${NC}"
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# 3. Create isolated virtual environment
echo -e "[1/2] Creating dedicated Python virtual environment (venv)..."
if [ ! -f "venv/bin/python" ]; then
    $PYTHON_CMD -m venv venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Failed to create virtual environment.${NC}"
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# 4. Install dependencies
echo -e "[2/2] Installing required AI packages into venv (first-time only)..."
./venv/bin/python -m pip install --upgrade pip >/dev/null 2>&1
./venv/bin/pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to install packages. Please run: ./venv/bin/pip install -r requirements.txt${NC}"
    read -p "Press Enter to exit..."
    exit 1
fi

# Mark installation as complete
touch .installed
echo ""
echo -e "${GREEN}===================================================================${NC}"
echo -e "${GREEN}[SUCCESS] Engine installed permanently!${NC}"
echo -e "Every future launch will now start in less than 1 second (no re-install)."
echo -e "${GREEN}===================================================================${NC}"
echo ""

echo -e "Starting Local AI Server on ${BLUE}http://127.0.0.1:8000${NC} ..."
echo "Opening Aura Storefront in your browser..."
echo ""
open "https://background-remover-frontend-delta.vercel.app/" 2>/dev/null || xdg-open "https://background-remover-frontend-delta.vercel.app/" 2>/dev/null &
./venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
