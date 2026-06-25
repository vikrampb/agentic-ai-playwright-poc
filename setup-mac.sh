#!/bin/bash
# ============================================================
# Agentic AI Framework - macOS Setup Script
# ============================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║       Agentic AI POC - macOS Setup Script           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Homebrew ──────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo -e "${YELLOW}Installing Homebrew...${NC}"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  echo -e "${GREEN}✓ Homebrew already installed${NC}"
fi

# ── 2. Node.js (via nvm) ─────────────────────────────────────
if ! command -v nvm &>/dev/null; then
  echo -e "${YELLOW}Installing nvm...${NC}"
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

echo -e "${YELLOW}Installing Node.js 20 LTS...${NC}"
nvm install 20
nvm use 20
nvm alias default 20
echo -e "${GREEN}✓ Node $(node -v) / npm $(npm -v)${NC}"

# ── 3. Git ───────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  brew install git
fi
echo -e "${GREEN}✓ Git $(git --version)${NC}"

# ── 4. GitHub CLI ────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo -e "${YELLOW}Installing GitHub CLI...${NC}"
  brew install gh
fi
echo -e "${GREEN}✓ GitHub CLI $(gh --version | head -1)${NC}"

# ── 5. SQLite ────────────────────────────────────────────────
if ! command -v sqlite3 &>/dev/null; then
  brew install sqlite
fi
echo -e "${GREEN}✓ SQLite $(sqlite3 --version)${NC}"

# ── 6. Project npm dependencies ──────────────────────────────
echo -e "${YELLOW}Installing project npm dependencies...${NC}"
npm install
npx playwright install --with-deps chromium

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Complete! ✓                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Copy .env.example → .env and fill in your secrets"
echo "  2. Run: npm run db:init        (seed the SQLite database)"
echo "  3. Run: npm run agent          (start the Agentic AI loop)"
echo ""
