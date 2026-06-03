#!/usr/bin/env bash
set -euo pipefail

# Prints the PR fork point (the commit we diff against to find changed files),
# or nothing when it can't be determined.
#
# On PRs, HEAD is the merge commit; its parents (HEAD^1, HEAD^2) are base and head,
# and the merge base of those two is the fork point. Requires the checkout to have
# enough history (fetch-depth: 100) for git merge-base to reach it.
#
# Callers fall back to running over everything when this prints nothing (non-PR
# events, or the merge base can't be computed).

[ "${GITHUB_EVENT_NAME:-}" = "pull_request" ] || exit 0
git merge-base HEAD^1 HEAD^2 2>/dev/null || true
