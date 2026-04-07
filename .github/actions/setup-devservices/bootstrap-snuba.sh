#!/bin/bash
set -euo pipefail

# Bootstrap per-worker Snuba instances, overlapping the expensive ClickHouse
# table setup with the devservices health-check wait.
#
# Phase 1 (early): As soon as ClickHouse is accepting queries, create per-worker
#   databases and run `snuba bootstrap --force`. This is the slow part.
# Phase 2 (after devservices): Stop snuba-snuba-1 and start per-worker API
#   containers. We must wait for devservices to finish first — stopping the
#   container while devservices is health-checking it would cause a timeout.
#
# Requires: XDIST_WORKERS env var
# Reads:    /tmp/ds-exit (written by setup-devservices/wait.sh)
# Writes:   /tmp/snuba-bootstrap-exit

WORKERS=${XDIST_WORKERS:?XDIST_WORKERS must be set}

echo "Waiting for ClickHouse and Snuba container..."
SECONDS=0
while true; do
  if [ $SECONDS -gt 300 ]; then
    echo "::error::Timed out waiting for Snuba bootstrap prerequisites"
    echo 1 > /tmp/snuba-bootstrap-exit
    exit 1
  fi
  if curl -sf 'http://localhost:8123/' > /dev/null 2>&1 \
    && docker inspect snuba-snuba-1 > /dev/null 2>&1; then
    break
  fi
  sleep 2
done
echo "Prerequisites ready (${SECONDS}s)"

SNUBA_IMAGE=$(docker inspect snuba-snuba-1 --format '{{.Config.Image}}')
SNUBA_NETWORK=$(docker inspect snuba-snuba-1 --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')
if [ -z "$SNUBA_IMAGE" ] || [ -z "$SNUBA_NETWORK" ]; then
  echo "::error::Could not inspect snuba-snuba-1 container"
  echo 1 > /tmp/snuba-bootstrap-exit
  exit 1
fi

SNUBA_ENV=(
  -e "CLICKHOUSE_HOST=clickhouse" -e "CLICKHOUSE_PORT=9000" -e "CLICKHOUSE_HTTP_PORT=8123"
  -e "DEFAULT_BROKERS=kafka:9093" -e "REDIS_HOST=redis" -e "REDIS_PORT=6379" -e "REDIS_DB=1"
  -e "SNUBA_SETTINGS=docker"
)

# Phase 1: Create databases and run bootstrap (the expensive part).
# This can safely run while devservices is still health-checking containers.
echo "Phase 1: bootstrapping ClickHouse databases"
BOOTSTRAP_PIDS=()
for i in $(seq 0 $(( WORKERS - 1 ))); do
  (
    WORKER_DB="default_gw${i}"
    curl -sf 'http://localhost:8123/' --data-binary "CREATE DATABASE IF NOT EXISTS ${WORKER_DB}"
    docker run --rm --network "$SNUBA_NETWORK" \
      -e "CLICKHOUSE_DATABASE=${WORKER_DB}" "${SNUBA_ENV[@]}" \
      "$SNUBA_IMAGE" bootstrap --force 2>&1 | tail -3
  ) &
  BOOTSTRAP_PIDS+=($!)
done

for pid in "${BOOTSTRAP_PIDS[@]}"; do
  wait "$pid" || { echo "ERROR: Snuba bootstrap (PID $pid) failed"; echo 1 > /tmp/snuba-bootstrap-exit; exit 1; }
done
echo "Phase 1 done (${SECONDS}s)"

# Phase 2: Wait for devservices to finish, then swap snuba-snuba-1 for per-worker containers.
while [ ! -f /tmp/ds-exit ]; do sleep 1; done

docker stop snuba-snuba-1 || true

echo "Phase 2: starting per-worker Snuba API containers"
GW_PIDS=()
for i in $(seq 0 $(( WORKERS - 1 ))); do
  (
    WORKER_DB="default_gw${i}"
    WORKER_PORT=$((1230 + i))
    docker run -d --name "snuba-gw${i}" --network "$SNUBA_NETWORK" \
      -p "${WORKER_PORT}:1218" \
      -e "CLICKHOUSE_DATABASE=${WORKER_DB}" "${SNUBA_ENV[@]}" \
      -e "DEBUG=1" "$SNUBA_IMAGE" api

    for attempt in $(seq 1 30); do
      if curl -sf "http://127.0.0.1:${WORKER_PORT}/health" > /dev/null 2>&1; then
        echo "snuba-gw${i} healthy on port ${WORKER_PORT}"
        break
      fi
      if [ "$attempt" -eq 30 ]; then
        echo "ERROR: snuba-gw${i} failed health check after 30 attempts"
        docker logs "snuba-gw${i}" 2>&1 | tail -20 || true
        exit 1
      fi
      sleep 2
    done
  ) &
  GW_PIDS+=($!)
done

RC=0
for pid in "${GW_PIDS[@]}"; do
  wait "$pid" || { echo "ERROR: Snuba gateway (PID $pid) failed"; RC=1; }
done

echo "Snuba bootstrap complete (${SECONDS}s total)"
echo $RC > /tmp/snuba-bootstrap-exit
exit $RC
