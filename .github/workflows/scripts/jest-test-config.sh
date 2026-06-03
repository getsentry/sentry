#!/usr/bin/env bash
set -euo pipefail

# Determines which Jest test files to run and computes a matrix for sharding.
#
# Inputs (env vars):
#   FRONTEND_ALL_FILES  - space-separated list of changed frontend files
#   GITHUB_EVENT_NAME   - set automatically by GitHub Actions
#   GITHUB_OUTPUT       - set automatically by GitHub Actions
#
# Outputs:
#   jest-test-files.json          - JSON array of test file paths (written to cwd)
#   jest_test_matrix (via output) - JSON matrix for GitHub Actions strategy

if [ "$GITHUB_EVENT_NAME" == "pull_request" ]; then
  MERGE_BASE=$(git merge-base HEAD^1 HEAD^2 2>/dev/null) || true
  if [ -n "$MERGE_BASE" ]; then
    CHANGED=$(git diff --name-only "$MERGE_BASE" HEAD^2)
    if echo "$CHANGED" | grep -qvE '^static/'; then
      echo "Non-frontend file changed — running full Jest suite"
      STRATEGY="full"
    else
      echo "Merge base: $MERGE_BASE (using --findRelatedTests)"
      STRATEGY="changedSince"
    fi
  else
    echo "Could not compute merge base — running full Jest suite"
    STRATEGY="full"
  fi
else
  echo "Push event — running full Jest suite"
  STRATEGY="full"
fi

if [ "$STRATEGY" == "changedSince" ]; then
  # shellcheck disable=SC2086
  JEST_TESTS="$(pnpm exec jest --listTests --json --findRelatedTests $FRONTEND_ALL_FILES | jq '.')"

  RUNNER_CHUNK_SIZE=250
  JEST_TESTS_LENGTH=$(echo "$JEST_TESTS" | jq 'length')
  if [ "$JEST_TESTS_LENGTH" -gt 0 ]; then
    RUNNERS=$(( ( ( JEST_TESTS_LENGTH + RUNNER_CHUNK_SIZE - 1 ) / RUNNER_CHUNK_SIZE ) > 0 ? ( ( JEST_TESTS_LENGTH + RUNNER_CHUNK_SIZE - 1 ) / RUNNER_CHUNK_SIZE ) : 1 ))
  else
    JEST_TESTS="$(pnpm exec jest --listTests --json)"
    RUNNERS=8
  fi
else
  JEST_TESTS="$(pnpm exec jest --listTests --json)"
  RUNNERS=8
fi
echo "$JEST_TESTS" > jest-test-files.json

INDEX_ARRAY=$(seq 0 $(( RUNNERS - 1 )) | jq -s .)
echo "jest_test_matrix=$(jq -nc --argjson index "$INDEX_ARRAY" --argjson total "$RUNNERS" '{index: $index, total: [$total]}')" >> "$GITHUB_OUTPUT"
