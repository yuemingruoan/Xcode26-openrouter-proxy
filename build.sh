#!/bin/bash

# Install dependencies and build executable
cd proxy
python3 -m venv build-env
source build-env/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller

echo "Building standalone executable..."
pyinstaller --onefile app.py

deactivate
rm -rf build-env

echo "Build complete! Executable located at: dist/app"
