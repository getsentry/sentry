#!/bin/sh
# Runs the backend test suite, across XDIST_WORKERS xdist workers when set,
# and stops a run that hangs after 20 minutes.
set -eu

if [ -n "${XDIST_WORKERS:-}" ]; then
  export PYTEST_ADDOPTS="${PYTEST_ADDOPTS:-} -n ${XDIST_WORKERS} --dist=loadfile"
  timeout -k 30 1200 make test-python-ci || {
    rc=$?
    if [ "$rc" -eq 124 ]; then
      echo "::error::Test run timed out after 20 minutes (possible xdist hang)"
    fi
    exit "$rc"
  }
else
  make test-python-ci
fi
