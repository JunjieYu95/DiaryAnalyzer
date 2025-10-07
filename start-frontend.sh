#!/bin/bash

# 🌐 Start Frontend Server Script
# Simpler version - just starts the frontend (backend is on Supabase cloud)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PORT=8000
# Frontend files are in root directory now (index.html, app.js, etc.)

echo -e "${BLUE}🚀 Starting Frontend Server${NC}\n"

# Function to kill process on port
kill_port() {
    local port=$1
    echo -e "${YELLOW}🔍 Checking port ${port}...${NC}"
    
    local pid=$(lsof -ti:${port} 2>/dev/null)
    
    if [ -z "$pid" ]; then
        echo -e "${GREEN}✓ Port ${port} is free${NC}"
    else
        echo -e "${YELLOW}⚠️  Port ${port} is occupied by PID ${pid}${NC}"
        echo -e "${YELLOW}   Terminating...${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✓ Port ${port} is now free${NC}"
    fi
}

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping server...${NC}"
    kill_port $PORT
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if index.html exists
if [ ! -f "index.html" ]; then
    echo -e "${RED}✗ index.html not found in current directory${NC}"
    echo -e "${YELLOW}  Please run this script from the project root${NC}"
    exit 1
fi

# Kill any process on the port
kill_port $PORT

echo ""
echo -e "${YELLOW}🌐 Starting server on port ${PORT}...${NC}"
echo -e "${GREEN}✓ Serving from project root${NC}"
echo -e "${BLUE}  → http://localhost:${PORT}${NC}"
echo ""
echo -e "${YELLOW}📝 Press Ctrl+C to stop${NC}"
echo ""

python3 -m http.server $PORT 2>&1 | while read line; do
    echo -e "${GREEN}[Server]${NC} $line"
done
