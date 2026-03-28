#!/usr/bin/env bash
set -euo pipefail

# Maps repo + PR number to a deterministic workspace name.
# Usage: compute-name.sh <repo> <pr_number>
#   repo: "sentry" or "getsentry"
#   pr_number: numeric PR number

REPO="${1:?Usage: compute-name.sh <repo> <pr_number>}"
PR_NUMBER="${2:?Usage: compute-name.sh <repo> <pr_number>}"

case "$REPO" in
    sentry|getsentry) ;;
    *) echo "Unknown repo: $REPO" >&2; exit 1 ;;
esac

echo "pr-${REPO}-${PR_NUMBER}"
