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

# Resolve the merge base and decide whether we can scope to the PR's changed files
# (scope=scoped) or must run everything (scope=full). We only need the scope here;
# --findRelatedTests reads the changed files from FRONTEND_ALL_FILES.
eval "$(./.github/workflows/scripts/frontend-changed-scope.sh)"

if [ "$scope" == "scoped" ]; then
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
