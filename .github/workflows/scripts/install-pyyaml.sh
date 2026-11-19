#!/bin/sh
# Installs the pyyaml version that uv.lock pins for development, without the
# rest of the development dependencies.
set -eu

# Like the `uv export | grep | sed | xargs uv pip install` pipeline under
# pipefail: every stage runs on what the one before printed, and the script
# fails with the status of the last stage that failed.
export_status=0
grep_status=0
sed_status=0
requirements=$(uv export --only-dev --no-hashes --no-annotate --no-header) || export_status=$?
pyyaml=$(printf '%s\n' "$requirements" | grep '^pyyaml') || grep_status=$?
pyyaml=$(printf '%s\n' "$pyyaml" | sed -E 's/ ;.*//') || sed_status=$?
printf '%s\n' "$pyyaml" | xargs uv pip install --index-url 'https://pypi.devinfra.sentry.io/simple'
for status in "$sed_status" "$grep_status" "$export_status"; do
  if [ "$status" -ne 0 ]; then
    exit "$status"
  fi
done
