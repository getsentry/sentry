#!/bin/sh
# Runs the acceptance tests across XDIST_WORKERS xdist workers with the
# Chrome for Testing build on PATH, and stops a run that hangs after 20
# minutes.
set -eu

: "${XDIST_WORKERS:?}"

export PYTEST_ADDOPTS="${PYTEST_ADDOPTS:-} -n ${XDIST_WORKERS} --dist=loadfile"
# Pins the Chrome for Testing build, not the image's Chrome, and skips
# the Selenium Manager lookup Selenium would run on every launch.
chrome=$(command -v google-chrome)
chromedriver=$(command -v chromedriver)
PYTEST_ADDOPTS="$PYTEST_ADDOPTS --chrome-path=$chrome --chromedriver-path=$chromedriver ${ACCEPTANCE_COVERAGE_ARGS:-}"
timeout -k 30 1200 make run-acceptance || rc=$?
[ "${rc:-0}" -ne 124 ] || echo "::error::Test run timed out after 20 minutes (possible xdist hang)"
exit "${rc:-0}"
