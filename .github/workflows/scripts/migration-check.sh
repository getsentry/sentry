#!/bin/bash
# This script expects devservices to be running. It's main purpose is to check
# that migrations and lockfiles are correct
set -eu
# This will fail if a migration or the lockfile are missing in the PR
exit_code=0
sentry django makemigrations --check --dry-run --no-input || exit_code=$?
if [ "$exit_code" == 1 ]; then
    echo -e "::error::Error: Migration required -- to generate a migration, run:\n" \
        "sentry django makemigrations -n <some_name> && git add migrations_lockfile.txt" >&2
elif [ "$exit_code" == 2 ]; then
    echo -e "::error::Error: Migration lockfile mismatch -- run:\n" \
        "sentry django makemigrations -n <some_name> && git add migrations_lockfile.txt" >&2
fi
exit $exit_code
