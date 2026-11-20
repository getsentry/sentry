#!/bin/sh
# Downloads the latest combined coverage database for selective testing and
# writes its path to the coverage-file output. The output is empty when the
# download fails, which runs the full test suite.
set -eu

: "${GITHUB_OUTPUT:?}"

mkdir -p .artifacts/coverage

GCS_PATH="gs://getsentry-coverage-data/latest/.coverage.combined"
echo "Fetching coverage DB from: $GCS_PATH"
gcloud storage ls -l "$GCS_PATH" 2>/dev/null || true

if ! gcloud storage cp "$GCS_PATH" \
  .artifacts/coverage/.coverage.combined 2>/dev/null; then
  echo "Warning: Failed to download coverage from GCS, will run full test suite"
  echo "coverage-file=" >>"$GITHUB_OUTPUT"
else
  ls -lh .artifacts/coverage/.coverage.combined
  echo "coverage-file=.artifacts/coverage/.coverage.combined" >>"$GITHUB_OUTPUT"
fi
