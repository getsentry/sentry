#!/usr/bin/env bash
set -euo pipefail

# Runs as root. Shrinks the image for faster snapshot and transfer.

apt-get clean
rm -rf /var/lib/apt/lists/*

echo "=== optimize-image.sh complete ==="
