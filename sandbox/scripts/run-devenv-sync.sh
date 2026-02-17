#!/usr/bin/env bash
set -euo pipefail

# Runs as sentry user. Uses `devenv sync` — the same canonical setup path
# used by every Sentry developer.
#
# After sync completes, stops all containers so Packer can snapshot the disk
# with volumes intact.

export PATH="/usr/local/bin:$PATH"
export SENTRY_CONF="/home/sentry/.sentry/"
cd /opt/sentry

###############################################################################
# Install devenv (as sentry user so the venv shebang is accessible)
###############################################################################
curl -fsSL https://raw.githubusercontent.com/getsentry/devenv/main/install-devenv.sh -o /tmp/install-devenv.sh
CI=1 bash /tmp/install-devenv.sh
export PATH="$HOME/.local/share/sentry-devenv/bin:$PATH"

SENTRY_DEVENV_VERBOSE=1 devenv sync

echo "--> Stopping all containers for clean snapshot"
docker stop $(docker ps -q) 2>/dev/null || true

echo "=== run-devenv-sync.sh complete ==="
