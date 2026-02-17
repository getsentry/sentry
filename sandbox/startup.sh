#!/usr/bin/env bash
set -euo pipefail

# Called by sandbox-startup.service on every boot (including resume from stop).
# Reads GCE instance metadata to determine branch and mode, then starts services.

export PATH="/opt/sentry/.venv/bin:/usr/local/bin:$PATH"
export SENTRY_CONF="/home/sentry/.sentry/"
cd /opt/sentry

METADATA_URL="http://metadata.google.internal/computeMetadata/v1/instance/attributes"
METADATA_HEADER="Metadata-Flavor: Google"

###############################################################################
# Read GCE instance metadata
###############################################################################
SANDBOX_BRANCH=$(curl -sf -H "$METADATA_HEADER" "$METADATA_URL/SANDBOX_BRANCH" 2>/dev/null || echo "")
SANDBOX_MODE=$(curl -sf -H "$METADATA_HEADER" "$METADATA_URL/SANDBOX_MODE" 2>/dev/null || echo "default")

echo "SANDBOX_BRANCH=${SANDBOX_BRANCH:-<not set>}"
echo "SANDBOX_MODE=${SANDBOX_MODE}"

###############################################################################
# Delete stale ready marker
###############################################################################
rm -f /tmp/sandbox-ready

###############################################################################
# Branch checkout (if specified and not master)
###############################################################################
if [ -n "$SANDBOX_BRANCH" ] && [ "$SANDBOX_BRANCH" != "master" ]; then
    echo "--> Checking out branch: $SANDBOX_BRANCH"
    sudo -u sentry git fetch origin
    sudo -u sentry git checkout "$SANDBOX_BRANCH" || sudo -u sentry git checkout -b "$SANDBOX_BRANCH" "origin/$SANDBOX_BRANCH"

    echo "--> Running devenv sync for branch"
    sudo -u sentry devenv sync
else
    echo "--> Warm path: staying on current branch"
fi

###############################################################################
# Start services (devservices handles its own health checks)
###############################################################################
echo "--> Starting devservices (mode: $SANDBOX_MODE)"
sudo -u sentry devservices up --mode "$SANDBOX_MODE"

###############################################################################
# Signal readiness
###############################################################################
touch /tmp/sandbox-ready
echo "=== sandbox ready ==="
