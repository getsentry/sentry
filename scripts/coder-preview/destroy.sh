#!/usr/bin/env bash
set -euo pipefail

# Destroy a Coder preview workspace and mark GitHub Deployments inactive.
#
# Required env vars:
#   CODER_URL            - Coder server URL (e.g. https://coder.sentry.dev)
#   CODER_SESSION_TOKEN  - API token for the ci-bot Coder user
#   GH_TOKEN             - GitHub token for Deployments API
#   GITHUB_REPOSITORY    - owner/repo (e.g. getsentry/sentry)
#   PR_NUMBER            - PR number
#   WORKSPACE_NAME       - Computed workspace name (e.g. pr-sentry-12345)

CODER_API="${CODER_URL}/api/v2"
AUTH_HEADER="Coder-Session-Token: ${CODER_SESSION_TOKEN}"

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

# ---------- Delete Coder workspace ----------

echo "Looking up workspace '${WORKSPACE_NAME}'..."
WORKSPACE_JSON=$(api \
    -H "${AUTH_HEADER}" \
    "${CODER_API}/workspaces?q=owner:me+name:${WORKSPACE_NAME}" | jq -r '.workspaces[0] // empty')

if [ -n "$WORKSPACE_JSON" ]; then
    WORKSPACE_ID=$(echo "$WORKSPACE_JSON" | jq -r '.id')
    WORKSPACE_STATUS=$(echo "$WORKSPACE_JSON" | jq -r '.latest_build.status')
    echo "Found workspace ${WORKSPACE_ID} (status: ${WORKSPACE_STATUS})"

    # Wait for any active build to finish before deleting
    while [[ "$WORKSPACE_STATUS" == "starting" || "$WORKSPACE_STATUS" == "stopping" || "$WORKSPACE_STATUS" == "deleting" ]]; do
        echo "  Build in progress (${WORKSPACE_STATUS}), waiting..."
        sleep 10
        WORKSPACE_STATUS=$(api \
            -H "${AUTH_HEADER}" \
            "${CODER_API}/workspaces/${WORKSPACE_ID}" | jq -r '.latest_build.status')
    done

    if [ "$WORKSPACE_STATUS" = "deleted" ]; then
        echo "Workspace already deleted."
    else
        echo "Deleting workspace..."
        api -X POST \
            -H "${AUTH_HEADER}" \
            -H "Content-Type: application/json" \
            "${CODER_API}/workspaces/${WORKSPACE_ID}/builds" \
            -d '{"transition": "delete"}' > /dev/null
        echo "Workspace deletion initiated."
    fi
else
    echo "Workspace '${WORKSPACE_NAME}' not found, nothing to delete."
fi

# ---------- Mark GitHub Deployments inactive ----------

echo "Marking GitHub Deployments inactive for PR #${PR_NUMBER}..."
ENVIRONMENT="pr-preview-${PR_NUMBER}"

DEPLOYMENTS=$(api \
    -H "Authorization: token ${GH_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/deployments?environment=${ENVIRONMENT}")

DEPLOYMENT_COUNT=$(echo "$DEPLOYMENTS" | jq 'length')
echo "Found ${DEPLOYMENT_COUNT} deployment(s) for environment '${ENVIRONMENT}'"

echo "$DEPLOYMENTS" | jq -r '.[].id' | while read -r dep_id; do
    echo "  Marking deployment ${dep_id} as inactive..."
    api -X POST \
        -H "Authorization: token ${GH_TOKEN}" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/${GITHUB_REPOSITORY}/deployments/${dep_id}/statuses" \
        -d '{"state": "inactive"}' > /dev/null
done

echo "Done! All deployments marked inactive."
