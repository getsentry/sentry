#!/usr/bin/env bash
set -euo pipefail

# Downloads the artifacts each jest shard needs:
#   jest-test-files.json - uploaded by the "Configure Jest" job in this run
#   jest-balance.json    - uploaded by the latest successful jest-balance.yml run on master
#
# This uses `gh` instead of actions/download-artifact and dawidd6/action-download-artifact
# because both of those parse $GITHUB_EVENT_PATH at startup, which races with the other
# steps in the jest job's parallel group (getsentry/sentry#127566). It also lets us retry
# the transient API/artifact storage errors those actions fail on.
#
# Inputs (env vars):
#   GH_TOKEN, GH_REPO - token with actions:read, and owner/repo
#   GITHUB_RUN_ID     - set automatically by GitHub Actions

ATTEMPTS=3

retry() {
  local attempt
  for attempt in $(seq 1 "$ATTEMPTS"); do
    if "$@"; then
      return 0
    fi
    echo "::warning::Attempt $attempt of $ATTEMPTS failed: $*" >&2
    if [ "$attempt" -lt "$ATTEMPTS" ]; then
      sleep $((attempt * 5))
    fi
  done
  return 1
}

# Extract into a fresh directory so a retry never trips over files left by a
# partially extracted earlier attempt, then copy into place.
download() { # <run-id> <artifact-name> <dest-dir>
  local tmp
  tmp="$(mktemp -d "${RUNNER_TEMP:-/tmp}/jest-artifact.XXXXXX")" &&
    gh run download "$1" --name "$2" --dir "$tmp" &&
    mkdir -p "$3" &&
    cp -R "$tmp/." "$3/"
}

retry download "$GITHUB_RUN_ID" jest-test-files .

balance_run="$(retry gh run list --workflow jest-balance.yml --branch master --status success \
  --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
if [ -z "$balance_run" ]; then
  # createJestConfig.ts falls back to splitting tests by file name.
  echo "::warning::No successful jest-balance.yml run found on master, shards will split tests by file name"
  exit 0
fi

# A shard without jest-balance.json would split tests differently from the other
# shards and silently skip some, so a download error here fails the job.
retry download "$balance_run" jest-balance.json tests/js/test-balancer
