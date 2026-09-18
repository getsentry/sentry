#!/usr/bin/env bash
set -euo pipefail

# Determines which Jest test files to run and computes a matrix for sharding.
#
# Inputs (env vars):
#   FRONTEND_ALL_FILES  - path for the NUL-delimited changed frontend files
#   GITHUB_EVENT_NAME   - set automatically by GitHub Actions
#   GITHUB_OUTPUT       - set automatically by GitHub Actions
#
# Outputs:
#   jest-test-files.json          - JSON array of test file paths (written to cwd)
#   jest_test_matrix (via output) - JSON matrix for GitHub Actions strategy

# Resolve the merge base and decide whether we can scope to the PR's changed files
# (scope=scoped) or must run everything (scope=full).
eval "$(./.github/workflows/scripts/frontend-changed-scope.sh)"

if [ "$scope" == "scoped" ]; then
  changed_files="${FRONTEND_ALL_FILES:-.artifacts/jest-changed-files}"
  mkdir -p "$(dirname "$changed_files")"
  git diff --name-only -z --diff-filter=AMR "$merge_base" HEAD^2 -- static/ > "$changed_files"

  # This is the serialized path-list byte length. Keep it below a
  # conservative portion of ARG_MAX; larger PRs run the full Jest suite.
  changed_files_bytes=$(wc -c < "$changed_files")
  if (( changed_files_bytes > 100000 )); then
    echo '::warning::Too many changed files for related-test discovery; running all Jest tests'
  else
    JEST_TESTS="$(
      xargs -0 -r pnpm exec jest --listTests --json --findRelatedTests < "$changed_files" |
        jq -s 'add // [] | unique'
    )"
  fi
fi

RUNNER_CHUNK_SIZE=250
JEST_TESTS_LENGTH=0
if [ -n "${JEST_TESTS:-}" ]; then
  JEST_TESTS_LENGTH=$(echo "$JEST_TESTS" | jq 'length')
fi

if [ "$JEST_TESTS_LENGTH" -gt 0 ]; then
  RUNNERS=$(( ( ( JEST_TESTS_LENGTH + RUNNER_CHUNK_SIZE - 1 ) / RUNNER_CHUNK_SIZE ) > 0 ? ( ( JEST_TESTS_LENGTH + RUNNER_CHUNK_SIZE - 1 ) / RUNNER_CHUNK_SIZE ) : 1 ))
else
  JEST_TESTS="$(pnpm exec jest --listTests --json)"
  RUNNERS=8
fi
echo "$JEST_TESTS" > jest-test-files.json

INDEX_ARRAY=$(seq 0 $(( RUNNERS - 1 )) | jq -s .)
echo "jest_test_matrix=$(jq -nc --argjson index "$INDEX_ARRAY" --argjson total "$RUNNERS" '{index: $index, total: [$total]}')" >> "$GITHUB_OUTPUT"
