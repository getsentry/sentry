#!/bin/sh
# Writes the first parent of HEAD to the commit output. On a pull_request
# merge commit (refs/pull/N/merge) that is the base branch tip, not one
# commit back on the pull request. Writes skip=true when HEAD has no parent.
set -eu

: "${GITHUB_OUTPUT:?}"

BASE_COMMIT=$(git rev-parse HEAD^1 2>/dev/null) || true
if [ -z "$BASE_COMMIT" ]; then
  echo "Could not determine base branch commit"
  echo "skip=true" >>"$GITHUB_OUTPUT"
else
  echo "commit=$BASE_COMMIT" >>"$GITHUB_OUTPUT"
  echo "Base branch commit: $BASE_COMMIT"
fi
