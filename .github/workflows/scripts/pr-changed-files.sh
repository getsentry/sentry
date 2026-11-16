#!/bin/sh
# Prints the pull request's changed files as files= and previous-filenames=
# lines for $GITHUB_OUTPUT (see parse-pr-files.py).
set -eu

: "${GITHUB_REPOSITORY:?}"
: "${PR_NUMBER:?}"

pr_files=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/files" --paginate)
python3 "$(dirname "$0")/parse-pr-files.py" <<JSON
$pr_files
JSON
