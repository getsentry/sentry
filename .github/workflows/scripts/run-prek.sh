#!/bin/sh
# Runs prek on the files in ALL_FILES, a JSON array of paths, or on every
# file when ALL_FILES is empty.
set -eux

if [ -z "${ALL_FILES:-}" ]; then
  .venv/bin/prek run -q --all-files
else
  # Like `jq | xargs` under pipefail: prek runs on whatever jq printed, and
  # the script fails with the status of the last stage that failed.
  jq_status=0
  files=$(jq '.[]' --raw-output <<JSON
$ALL_FILES
JSON
) || jq_status=$?
  printf '%s\n' "$files" | xargs .venv/bin/prek run -q --files
  exit "$jq_status"
fi
