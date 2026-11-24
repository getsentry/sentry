#!/bin/sh
# Prints devservices logs, and with XDIST_PER_WORKER_SNUBA=1 the tail of each
# per-worker Snuba container's logs, after a failed backend or acceptance job.
set -eu

if command -v devservices; then
  devservices logs
fi

if [ "${XDIST_PER_WORKER_SNUBA:-}" = "1" ]; then
  for i in $(seq 0 $((XDIST_WORKERS - 1))); do
    echo "--- snuba-gw${i} logs ---"
    docker logs "snuba-gw${i}" 2>&1 | tail -30 || true
  done
fi
