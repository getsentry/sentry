#!/usr/bin/env bash
set -euo pipefail

# Destroy a Coder workspace used for CI RCA analysis.
# Designed to run in the `if: always()` cleanup step.
#
# Prerequisites:
#   coder CLI must be installed and authenticated (via coder/setup-action)
#
# Required env vars:
#   WORKSPACE_NAME       - Workspace name to destroy

echo "Looking up workspace '${WORKSPACE_NAME}'..."

# Check if workspace exists
if ! coder show "${WORKSPACE_NAME}" --output json > /dev/null 2>&1; then
    echo "Workspace '${WORKSPACE_NAME}' not found, nothing to destroy."
    exit 0
fi

WORKSPACE_STATUS=$(coder show "${WORKSPACE_NAME}" --output json | jq -r '.latest_build.status // "unknown"')
echo "Found workspace (status: ${WORKSPACE_STATUS})"

# Wait for any active build to finish before deleting
while [[ "$WORKSPACE_STATUS" == "starting" || "$WORKSPACE_STATUS" == "stopping" || \
         "$WORKSPACE_STATUS" == "deleting" || "$WORKSPACE_STATUS" == "canceling" ]]; do
    echo "  Build in progress (${WORKSPACE_STATUS}), waiting..."
    sleep 10
    WORKSPACE_STATUS=$(coder show "${WORKSPACE_NAME}" --output json 2>/dev/null \
        | jq -r '.latest_build.status // "deleted"')
done

if [ "$WORKSPACE_STATUS" = "deleted" ]; then
    echo "Workspace already deleted."
    exit 0
fi

echo "Deleting workspace..."
coder delete "${WORKSPACE_NAME}" --yes
echo "Workspace deletion initiated."
