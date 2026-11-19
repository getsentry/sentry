#!/bin/sh
# Runs prek on the files in CHANGED_FILES, a JSON array of paths, or on every
# file when TOO_MANY_FILES or LINT_CONFIG_CHANGED is "true".
set -eux

if [ "${TOO_MANY_FILES:-}" = true ] || [ "${LINT_CONFIG_CHANGED:-}" = true ]; then
  .venv/bin/prek run -q --all-files
else
  # Like `jq | xargs` under pipefail: prek runs on whatever jq printed, and
  # the script fails with the status of the last stage that failed.
  jq_status=0
  files=$(jq '.[]' --raw-output <<JSON
$CHANGED_FILES
JSON
) || jq_status=$?
  printf '%s\n' "$files" | xargs .venv/bin/prek run -q --files
  exit "$jq_status"
fi
