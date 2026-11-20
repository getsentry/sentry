#!/bin/sh
# Writes the merge base of a pull request's base and head commits to the sha
# output.
set -eu

: "${GITHUB_OUTPUT:?}"

MERGE_BASE=$(gh api "repos/$GITHUB_REPOSITORY/compare/$BASE_SHA...$HEAD_SHA" --jq '.merge_base_commit.sha')
echo "sha=$MERGE_BASE" >>"$GITHUB_OUTPUT"
