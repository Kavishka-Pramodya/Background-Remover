#!/usr/bin/env bash
# ===================================================================
#   AURA E-COMMERCE: LOCAL AI PRODUCT STUDIO ENGINE (macOS / Linux)
# ===================================================================

# Navigate to script directory
cd "$(dirname "$0")" || exit 1

# Color definitions
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}===================================================================${NC}"
echo -e "${GREEN}      AURA E-COMMERCE: LOCAL AI PRODUCT STUDIO ENGINE (macOS)${NC}"
echo -e "${GREEN}===================================================================${NC}"
echo ""
echo -e "Starting local AI companion for your online store..."
echo -e "Local API: ${BLUE}http://127.0.0.1:8000${NC}"
echo -e "Web Store: ${BLUE}https://background-remover-frontend-delta.vercel.app/${NC}"
echo ""
echo -e "[Key Advantages]"
echo -e "- 100% FREE forever (No expensive cloud hosting / zero server costs)"
echo -e "- Unlimited high-resolution product photos"
echo -e "- Fast local processing powered by your Mac"
echo ""
echo -e "${GREEN}===================================================================${NC}"
echo ""

# 1. Check Python
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo -e "${RED}[ERROR] Python 3 is not installed on this Mac.${NC}"
    echo "Please install Python 3.10+ from https://www.python.org/downloads/ or via Homebrew (brew install python)."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo -e "Using Python: $($PYTHON_CMD --version)"

# 2. Check if backend folder exists. If not, auto-download from GitHub
if [ ! -f "backend/main.py" ]; then
    echo -e "${YELLOW}[INFO] Backend engine not detected in current folder.${NC}"
    echo "Downloading lightweight AI engine from repository..."
    if command -v curl &> /dev/null; then
        curl -L -o aura_engine_repo.zip "https://github.com/Kavishka-Pramodya/Background-Remover/archive/refs/heads/main.zip"
    else
        echo -e "${RED}[ERROR] curl not found. Please download repository zip manually.${NC}"
        read -p "Press Enter to exit..."
        exit 1
    fi

    if [ -f "aura_engine_repo.zip" ]; then
        echo "Extracting engine files..."
        unzip -q aura_engine_repo.zip -d temp_extract
        cp -r temp_extract/Background-Remover-main/backend .
        cp temp_extract/Background-Remover-main/requirements.txt .
        rm -rf temp_extract aura_engine_repo.zip
        echo -e "${GREEN}[OK] Engine downloaded successfully!${NC}"
    fi
fi

# 3. Verify / Install Python dependencies
echo -e "[1/2] Verifying Python AI dependencies..."
$PYTHON_CMD -c "import fastapi, uvicorn, rembg, PIL" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Installing required packages (first-time setup only)...${NC}"
    $PYTHON_CMD -m pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Failed to install packages. Please run: pip3 install -r requirements.txt${NC}"
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# 4. Launch Local AI Engine
echo ""
echo -e "[2/2] ${GREEN}Starting Local AI Server on http://127.0.0.1:8000 ...${NC}"
echo "Keep this Terminal window open while working in Aura Store!"
echo ""

# Open default browser on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "https://background-remover-frontend-delta.vercel.app/" &
elif command -v xdg-open &> /dev/null; then
    xdg-open "https://background-remover-frontend-delta.vercel.app/" &
fi

$PYTHON_CMD -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
