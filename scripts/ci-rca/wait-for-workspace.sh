#!/usr/bin/env bash
set -euo pipefail

# Wait for a Coder workspace to become ready (running + agent connected).
#
# Prerequisites:
#   coder CLI must be installed and authenticated (via coder/setup-action)
#
# Required env vars:
#   WORKSPACE_NAME       - Workspace name to wait for

# ---------- Wait for workspace to be running ----------

echo "Waiting for workspace '${WORKSPACE_NAME}' to be running..."
MAX_WAIT=300
ELAPSED=0
POLL_INTERVAL=10

while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
    STATUS=$(coder show "${WORKSPACE_NAME}" --output json 2>/dev/null \
        | jq -r '.latest_build.status // "unknown"')

    echo "  Status: ${STATUS} (${ELAPSED}s elapsed)"

    case "$STATUS" in
        running)
            echo "Workspace is running!"
            break
            ;;
        failed|canceled)
            echo "ERROR: Workspace build ${STATUS}" >&2
            exit 1
            ;;
    esac

    sleep "$POLL_INTERVAL"
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: Timed out waiting for workspace to start" >&2
    exit 1
fi

# ---------- Wait for agent to connect ----------

echo "Waiting for agent to connect..."
MAX_AGENT_WAIT=300
AGENT_ELAPSED=0

while [ "$AGENT_ELAPSED" -lt "$MAX_AGENT_WAIT" ]; do
    AGENT_STATUS=$(coder show "${WORKSPACE_NAME}" --output json 2>/dev/null \
        | jq -r '.latest_build.resources[]?.agents[]?.status // empty' | head -1)

    echo "  Agent: ${AGENT_STATUS:-no agent yet} (${AGENT_ELAPSED}s elapsed)"

    if [ "$AGENT_STATUS" = "connected" ]; then
        echo "Agent connected!"
        break
    fi

    sleep 10
    AGENT_ELAPSED=$((AGENT_ELAPSED + 10))
done

if [ "$AGENT_ELAPSED" -ge "$MAX_AGENT_WAIT" ]; then
    echo "ERROR: Agent did not connect within timeout" >&2
    exit 1
fi

echo "Workspace is fully ready."
