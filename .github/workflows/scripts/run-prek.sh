#!/bin/sh
# Runs prek on the files in ALL_FILES, a JSON array of paths, or on every
# file when ALL_FILES is empty.
set -eux

if [ -z "${ALL_FILES:-}" ]; then
  .venv/bin/prek run -q --all-files
else
  files=$(jq '.[]' --raw-output <<JSON
$ALL_FILES
JSON
)
  printf '%s\n' "$files" | xargs .venv/bin/prek run -q --files
fi
