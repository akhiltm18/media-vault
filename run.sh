#!/usr/bin/env bash
set -e

# Navigate to script directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
fi

echo "=========================================================="
echo " Starting MediaVault Photo & Video Storage Website"
echo " Access URL: http://localhost:5000"
echo "=========================================================="

./venv/bin/python3 app.py
