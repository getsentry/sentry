#!/bin/sh
# Runs this shard's acceptance tests. With COLLECT_COVERAGE=true, also records
# per-test Python coverage to .artifacts/acceptance.coverage, which
# compute-acceptance-selected-tests.py reads to select tests for pull requests.
set -eu

: "${XDIST_WORKERS:?}"

# Pins the Chrome for Testing build, not the image's Chrome, and skips the
# Selenium Manager lookup Selenium would run on every launch.
chrome=$(command -v google-chrome)
chromedriver=$(command -v chromedriver)
PYTEST_ADDOPTS="${PYTEST_ADDOPTS:-} -n $XDIST_WORKERS --dist=loadfile"
PYTEST_ADDOPTS="$PYTEST_ADDOPTS --chrome-path=$chrome --chromedriver-path=$chromedriver"

if [ "${COLLECT_COVERAGE:-}" = true ]; then
  PYTHONPATH="$PWD/.github/workflows/scripts${PYTHONPATH:+:$PYTHONPATH}"
  COVERAGE_FILE="$PWD/.artifacts/acceptance.coverage"
  export PYTHONPATH COVERAGE_FILE
  PYTEST_ADDOPTS="$PYTEST_ADDOPTS -p acceptance_coverage_warmup --cov=src --cov-context=test --cov-report="
fi
export PYTEST_ADDOPTS

rc=0
timeout -k 30 1200 make run-acceptance || rc=$?
if [ "$rc" -eq 124 ]; then
  echo "::error::Test run timed out after 20 minutes (possible xdist hang)"
fi
exit "$rc"
