#!/usr/bin/env bash
set -euo pipefail

# Create a Coder workspace for CI failure RCA analysis.
#
# Prerequisites:
#   coder CLI must be installed and authenticated (via coder/setup-action)
#
# Required env vars:
#   CODER_URL            - Coder server URL (set by coder/setup-action)
#   WORKSPACE_NAME       - Computed workspace name (e.g. ci-rca-20260311-143000)

CODER_API="${CODER_URL}/api/v2"
TEMPLATE_NAME="${TEMPLATE_NAME:-sentry-devbox}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-standard-8}"

# Read session token from coder CLI config (set by coder login via setup-action)
CODER_TOKEN=$(coder tokens list -o json 2>/dev/null | jq -r '.[0].id // empty' || true)
if [ -z "$CODER_TOKEN" ]; then
    # Fallback: read from config file
    CODER_TOKEN=$(cat ~/.config/coderv2/session 2>/dev/null || echo "${CODER_SESSION_TOKEN:-}")
fi
AUTH_HEADER="Coder-Session-Token: ${CODER_TOKEN}"

# curl wrapper that shows response body on failure
api() {
    local response http_code
    response=$(curl -sS -w "\n%{http_code}" -H "${AUTH_HEADER}" "$@")
    http_code=$(echo "$response" | tail -1)
    response=$(echo "$response" | sed '$d')

    if [[ "$http_code" -ge 400 ]]; then
        # 410 = already deleted, not a real error for our use case
        if [[ "$http_code" -eq 410 ]]; then
            echo ""
            return 0
        fi
        echo "ERROR: HTTP ${http_code}" >&2
        echo "$response" >&2
        return 1
    fi
    echo "$response"
}

# ---------- Look up template ----------

echo "Looking up template '${TEMPLATE_NAME}'..."
TEMPLATE_ID=$(api "${CODER_API}/templates" | jq -r ".[] | select(.name == \"${TEMPLATE_NAME}\") | .id")

if [ -z "$TEMPLATE_ID" ]; then
    echo "ERROR: Template '${TEMPLATE_NAME}' not found" >&2
    exit 1
fi

ACTIVE_VERSION_ID=$(api "${CODER_API}/templates/${TEMPLATE_ID}" | jq -r '.active_version_id')

echo "Template ID: ${TEMPLATE_ID}, Active Version: ${ACTIVE_VERSION_ID}"

# ---------- Build parameter payload ----------

BUILD_PARAMS=$(jq -n \
    --arg version_id "$ACTIVE_VERSION_ID" \
    --arg machine_type "$MACHINE_TYPE" \
    '{
        template_version_id: $version_id,
        transition: "start",
        rich_parameter_values: [
            {name: "machine_type", value: $machine_type}
        ]
    }')

# ---------- Check if workspace already exists ----------

echo "Checking for existing workspace '${WORKSPACE_NAME}'..."
WORKSPACE_JSON=$(api \
    "${CODER_API}/workspaces?q=owner:me+name:${WORKSPACE_NAME}" | jq -r '.workspaces[0] // empty')

if [ -n "$WORKSPACE_JSON" ]; then
    WORKSPACE_ID=$(echo "$WORKSPACE_JSON" | jq -r '.id')
    WORKSPACE_STATUS=$(echo "$WORKSPACE_JSON" | jq -r '.latest_build.status')
    echo "Workspace exists: ${WORKSPACE_ID} (status: ${WORKSPACE_STATUS})"

    # Wait for any in-progress build to finish
    while [[ "$WORKSPACE_STATUS" == "starting" || "$WORKSPACE_STATUS" == "stopping" || \
             "$WORKSPACE_STATUS" == "canceling" || "$WORKSPACE_STATUS" == "pending" || \
             "$WORKSPACE_STATUS" == "deleting" ]]; do
        echo "  Build in progress (${WORKSPACE_STATUS}), waiting..."
        sleep 10
        if ! WORKSPACE_STATUS=$(api \
            "${CODER_API}/workspaces/${WORKSPACE_ID}" | jq -r '.latest_build.status'); then
            WORKSPACE_STATUS="deleted"
        fi
    done

    if [ "$WORKSPACE_STATUS" = "deleted" ]; then
        echo "Workspace was deleted, creating fresh..."
        WORKSPACE_JSON=""
    elif [ "$WORKSPACE_STATUS" = "running" ]; then
        echo "Workspace already running, reusing."
    else
        echo "Workspace is ${WORKSPACE_STATUS}, triggering start..."
        api -X POST \
            -H "Content-Type: application/json" \
            "${CODER_API}/workspaces/${WORKSPACE_ID}/builds" \
            -d "$BUILD_PARAMS" > /dev/null
    fi
fi

if [ -z "$WORKSPACE_JSON" ]; then
    echo "Creating workspace '${WORKSPACE_NAME}'..."
    WORKSPACE_JSON=$(api -X POST \
        -H "Content-Type: application/json" \
        "${CODER_API}/users/me/workspaces" \
        -d "$(jq -n \
            --arg name "$WORKSPACE_NAME" \
            --argjson params "$BUILD_PARAMS" \
            '$params + {name: $name}')")
    WORKSPACE_ID=$(echo "$WORKSPACE_JSON" | jq -r '.id')
    echo "Created workspace: ${WORKSPACE_ID}"
fi

echo "Workspace creation initiated."
