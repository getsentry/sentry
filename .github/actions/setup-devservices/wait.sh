#!/bin/bash
set -euo pipefail

# Wait for the background devservices process started by the setup-devservices action.
# Usage: wait.sh [timeout_seconds]
TIMEOUT=${1:-600}

SECONDS=0
while [ ! -f /tmp/ds-exit ]; do
  if [ $SECONDS -gt "$TIMEOUT" ]; then
    echo "::error::Timed out waiting for devservices after ${TIMEOUT}s"
    cat /tmp/ds.log
    exit 1
  fi
  sleep 2
done

DS_RC=$(< /tmp/ds-exit)
if [ "$DS_RC" -ne 0 ]; then
  echo "::error::devservices up failed (exit $DS_RC)"
  cat /tmp/ds.log
  exit 1
fi

echo "DJANGO_LIVE_TEST_SERVER_ADDRESS=$(docker network inspect bridge --format='{{(index .IPAM.Config 0).Gateway}}')" >> "$GITHUB_ENV"
docker ps -a
