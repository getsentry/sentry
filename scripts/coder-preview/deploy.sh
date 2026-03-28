#!/usr/bin/env bash
set -euo pipefail

# Deploy a Coder preview workspace for a GitHub PR.
#
# Required env vars:
#   CODER_URL            - Coder server URL (e.g. https://coder.sentry.dev)
#   CODER_SESSION_TOKEN  - API token for the ci-bot Coder user
#   GH_TOKEN             - GitHub token for Deployments API
#   GITHUB_REPOSITORY    - owner/repo (e.g. getsentry/sentry)
#   PR_NUMBER            - PR number
#   PR_URL               - Full GitHub PR URL
#   WORKSPACE_NAME       - Computed workspace name (e.g. pr-sentry-12345)
#   TEMPLATE_NAME        - Coder template name (e.g. sentry-devbox)

CODER_API="${CODER_URL}/api/v2"
AUTH_HEADER="Coder-Session-Token: ${CODER_SESSION_TOKEN}"
MACHINE_TYPE="e2-standard-8"

# curl wrapper that shows response body on failure
api() {
    local response http_code
    response=$(curl -sS -w "\n%{http_code}" "$@")
    http_code=$(echo "$response" | tail -1)
    response=$(echo "$response" | sed '$d')

    if [[ "$http_code" -ge 400 ]]; then
        echo "ERROR: HTTP ${http_code}" >&2
        echo "$response" >&2
        return 1
    fi
    echo "$response"
}

# ---------- GitHub Deployment: in_progress ----------

echo "Creating GitHub Deployment (in_progress)..."
DEPLOYMENT_ID=$(api -X POST \
    -H "Authorization: token ${GH_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/deployments" \
    -d "$(jq -n \
        --arg ref "refs/pull/${PR_NUMBER}/head" \
        --arg env "pr-preview-${PR_NUMBER}" \
        '{
            ref: $ref,
            environment: $env,
            auto_merge: false,
            required_contexts: [],
            transient_environment: true,
            production_environment: false,
            description: "Coder PR preview workspace"
        }')" | jq -r '.id')

echo "Deployment ID: ${DEPLOYMENT_ID}"

update_deployment_status() {
    local state="$1"
    local url="${2:-}"
    local description="${3:-}"

    local body
    body=$(jq -n \
        --arg state "$state" \
        --arg url "$url" \
        --arg description "$description" \
        '{
            state: $state,
            environment_url: (if $url != "" then $url else null end),
            description: (if $description != "" then $description else null end),
            auto_inactive: false
        }')

    api -X POST \
        -H "Authorization: token ${GH_TOKEN}" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/${GITHUB_REPOSITORY}/deployments/${DEPLOYMENT_ID}/statuses" \
        -d "$body" > /dev/null
}

# ---------- Look up template ----------

echo "Looking up template '${TEMPLATE_NAME}'..."
TEMPLATE_ID=$(api \
    -H "${AUTH_HEADER}" \
    "${CODER_API}/templates" | jq -r ".[] | select(.name == \"${TEMPLATE_NAME}\") | .id")

if [ -z "$TEMPLATE_ID" ]; then
    echo "ERROR: Template '${TEMPLATE_NAME}' not found" >&2
    update_deployment_status "failure" "" "Template not found"
    exit 1
fi

ACTIVE_VERSION_ID=$(api \
    -H "${AUTH_HEADER}" \
    "${CODER_API}/templates/${TEMPLATE_ID}" | jq -r '.active_version_id')

echo "Template ID: ${TEMPLATE_ID}, Active Version: ${ACTIVE_VERSION_ID}"

# ---------- Build parameter payload (shared across create/start/rebuild) ----------

BUILD_PARAMS=$(jq -n \
    --arg version_id "$ACTIVE_VERSION_ID" \
    --arg pr_url "$PR_URL" \
    --arg machine_type "$MACHINE_TYPE" \
    '{
        template_version_id: $version_id,
        transition: "start",
        rich_parameter_values: [
            {name: "branch", value: $pr_url},
            {name: "start_devserver", value: "true"},
            {name: "machine_type", value: $machine_type}
        ]
    }')

# ---------- Check if workspace already exists ----------

echo "Checking for existing workspace '${WORKSPACE_NAME}'..."
WORKSPACE_JSON=$(api \
    -H "${AUTH_HEADER}" \
    "${CODER_API}/workspaces?q=owner:me+name:${WORKSPACE_NAME}" | jq -r '.workspaces[0] // empty')

if [ -n "$WORKSPACE_JSON" ]; then
    WORKSPACE_ID=$(echo "$WORKSPACE_JSON" | jq -r '.id')
    WORKSPACE_STATUS=$(echo "$WORKSPACE_JSON" | jq -r '.latest_build.status')
    echo "Workspace exists: ${WORKSPACE_ID} (status: ${WORKSPACE_STATUS})"

    # Wait for any in-progress build to finish before triggering a new one
    while [[ "$WORKSPACE_STATUS" == "starting" || "$WORKSPACE_STATUS" == "stopping" || "$WORKSPACE_STATUS" == "canceling" || "$WORKSPACE_STATUS" == "pending" || "$WORKSPACE_STATUS" == "deleting" ]]; do
        echo "  Build in progress (${WORKSPACE_STATUS}), waiting..."
        sleep 10
        # 410 means workspace was fully deleted
        if ! WORKSPACE_STATUS=$(api \
            -H "${AUTH_HEADER}" \
            "${CODER_API}/workspaces/${WORKSPACE_ID}" | jq -r '.latest_build.status'); then
            WORKSPACE_STATUS="deleted"
        fi
    done

    if [ "$WORKSPACE_STATUS" = "deleted" ]; then
        echo "Workspace was deleted, creating fresh..."
        WORKSPACE_JSON=""
    else
        echo "Workspace is ${WORKSPACE_STATUS}, triggering build with updated branch..."
        api -X POST \
            -H "${AUTH_HEADER}" \
            -H "Content-Type: application/json" \
            "${CODER_API}/workspaces/${WORKSPACE_ID}/builds" \
            -d "$BUILD_PARAMS" > /dev/null
    fi
fi

if [ -z "$WORKSPACE_JSON" ]; then
    # ---------- Create new workspace ----------
    echo "Creating workspace '${WORKSPACE_NAME}'..."
    WORKSPACE_JSON=$(api -X POST \
        -H "${AUTH_HEADER}" \
        -H "Content-Type: application/json" \
        "${CODER_API}/users/me/workspaces" \
        -d "$(jq -n \
            --arg name "$WORKSPACE_NAME" \
            --argjson params "$BUILD_PARAMS" \
            '$params + {name: $name}')")
    WORKSPACE_ID=$(echo "$WORKSPACE_JSON" | jq -r '.id')
    echo "Created workspace: ${WORKSPACE_ID}"
fi

# ---------- Poll until running ----------

echo "Waiting for workspace to be running..."
MAX_WAIT=300  # 5 minutes
ELAPSED=0
POLL_INTERVAL=10

while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
    STATUS=$(api \
        -H "${AUTH_HEADER}" \
        "${CODER_API}/workspaces/${WORKSPACE_ID}" | jq -r '.latest_build.status')

    echo "  Status: ${STATUS} (${ELAPSED}s elapsed)"

    case "$STATUS" in
        running)
            echo "Workspace is running!"
            break
            ;;
        failed|canceled)
            echo "ERROR: Workspace build ${STATUS}" >&2
            update_deployment_status "failure" "" "Workspace build ${STATUS}"
            exit 1
            ;;
    esac

    sleep "$POLL_INTERVAL"
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: Timed out waiting for workspace" >&2
    update_deployment_status "failure" "" "Workspace build timed out"
    exit 1
fi

# ---------- Wait for agent to connect ----------

echo "Waiting for agent to connect..."
MAX_AGENT_WAIT=300  # 5 minutes
AGENT_ELAPSED=0

while [ "$AGENT_ELAPSED" -lt "$MAX_AGENT_WAIT" ]; do
    AGENT_STATUS=$(api \
        -H "${AUTH_HEADER}" \
        "${CODER_API}/workspaces/${WORKSPACE_ID}" | jq -r '.latest_build.resources[]?.agents[]?.status // empty' | head -1)

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
    update_deployment_status "failure" "" "Agent failed to connect"
    exit 1
fi

# ---------- Wait for devserver to be healthy ----------

echo "Waiting for devserver health check..."
MAX_HEALTH_WAIT=600  # 10 minutes — devserver takes a while to start
HEALTH_ELAPSED=0

while [ "$HEALTH_ELAPSED" -lt "$MAX_HEALTH_WAIT" ]; do
    APP_HEALTH=$(api \
        -H "${AUTH_HEADER}" \
        "${CODER_API}/workspaces/${WORKSPACE_ID}" | jq -r '.latest_build.resources[]?.agents[]?.apps[]? | select(.slug == "sentry-dev") | .health' | head -1)

    echo "  Devserver app health: ${APP_HEALTH:-unknown} (${HEALTH_ELAPSED}s elapsed)"

    if [ "$APP_HEALTH" = "healthy" ]; then
        echo "Devserver is healthy!"
        break
    fi

    sleep 15
    HEALTH_ELAPSED=$((HEALTH_ELAPSED + 15))
done

if [ "$HEALTH_ELAPSED" -ge "$MAX_HEALTH_WAIT" ]; then
    echo "ERROR: Devserver did not become healthy within timeout" >&2
    update_deployment_status "failure" "" "Devserver health check timed out"
    exit 1
fi

OWNER_NAME=$(api \
    -H "${AUTH_HEADER}" \
    "${CODER_API}/users/me" | jq -r '.username')

PREVIEW_URL="https://sentry-dev--${WORKSPACE_NAME}--${OWNER_NAME}.coder.sentry.dev"
echo "Preview URL: ${PREVIEW_URL}"

# ---------- GitHub Deployment: success ----------

update_deployment_status "success" "$PREVIEW_URL" "Coder preview workspace running"

echo "Done! Deployment marked as success."
