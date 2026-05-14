#!/usr/bin/env bash
set -euo pipefail

readonly KAFKA_CONTAINER="${KAFKA_CONTAINER:-kafka-kafka-1}"
readonly TASKBROKER_CONTAINER="${TASKBROKER_CONTAINER:-taskbroker-taskbroker-1}"
readonly TASKWORKER_GROUP="${TASKWORKER_GROUP:-taskworker}"
readonly TASKWORKER_TOPIC="${TASKWORKER_TOPIC:-taskworker}"
readonly SUPERVISOR_CONFIG="${SUPERVISOR_CONFIG:-$HOME/.local/share/sentry-devservices/supervisor/sentry.processes.conf}"
readonly TASKBROKER_INFLIGHT_DB="${TASKBROKER_INFLIGHT_DB:-/opt/taskbroker-inflight.sqlite}"

EVAL_TASKWORKERS=(
  taskworker-evals-relay
  taskworker-evals-ingest-errors
  taskworker-evals-ingest-errors-postprocess
  taskworker-evals-issues
)

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to reset the local taskworker offset." >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$KAFKA_CONTAINER"; then
  echo "Kafka container '$KAFKA_CONTAINER' is not running. Start local devservices first." >&2
  exit 1
fi

running_eval_taskworkers=()
if [[ -f "$SUPERVISOR_CONFIG" ]]; then
  for taskworker in "${EVAL_TASKWORKERS[@]}"; do
    if supervisorctl -c "$SUPERVISOR_CONFIG" status "$taskworker" 2>/dev/null | grep -q RUNNING; then
      running_eval_taskworkers+=("$taskworker")
    fi
  done
fi

if [[ "${#running_eval_taskworkers[@]}" -gt 0 ]]; then
  echo "Stopping eval taskworkers so they reconnect after taskbroker restarts..."
  supervisorctl -c "$SUPERVISOR_CONFIG" stop "${running_eval_taskworkers[@]}" >/dev/null
fi

taskbroker_was_running=0
if docker ps --format '{{.Names}}' | grep -qx "$TASKBROKER_CONTAINER"; then
  taskbroker_was_running=1
  echo "Clearing $TASKBROKER_CONTAINER inflight task store..."
  docker exec "$TASKBROKER_CONTAINER" sh -c 'rm -f "$1" "$1"-*' sh "$TASKBROKER_INFLIGHT_DB" >/dev/null
  echo "Stopping $TASKBROKER_CONTAINER so Kafka will allow a consumer-group reset..."
  docker stop --time 10 "$TASKBROKER_CONTAINER" >/dev/null
fi

restart_taskbroker() {
  if [[ "$taskbroker_was_running" == "1" ]]; then
    echo "Restarting $TASKBROKER_CONTAINER..."
    docker start "$TASKBROKER_CONTAINER" >/dev/null
  fi
}

restart_eval_taskworkers() {
  if [[ "${#running_eval_taskworkers[@]}" -gt 0 ]]; then
    echo "Restarting eval taskworkers..."
    supervisorctl -c "$SUPERVISOR_CONFIG" start "${running_eval_taskworkers[@]}" >/dev/null
  fi
}

cleanup() {
  local status=0
  restart_taskbroker || status=$?
  restart_eval_taskworkers || status=$?
  return "$status"
}
trap cleanup EXIT

echo "Resetting consumer group '$TASKWORKER_GROUP' on topic '$TASKWORKER_TOPIC' to latest..."
docker exec "$KAFKA_CONTAINER" kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group "$TASKWORKER_GROUP" \
  --topic "$TASKWORKER_TOPIC" \
  --reset-offsets \
  --to-latest \
  --execute

if cleanup; then
  trap - EXIT
else
  cleanup_status=$?
  trap - EXIT
  exit "$cleanup_status"
fi
echo "Local eval taskworker offset is clean."
