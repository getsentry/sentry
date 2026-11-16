#!/bin/sh
# Downloads the newest acceptance coverage that a master run of acceptance.yml
# uploaded, to $1. Leaves $1 missing when there is none yet.
set -eu

: "${GITHUB_REPOSITORY:?}"
dest=$1

artifact_id=$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=acceptance-coverage&per_page=20" \
  --jq '[.artifacts[] | select(.workflow_run.head_branch == "master" and (.expired | not))][0].id // empty')
if [ -z "$artifact_id" ]; then
  echo "No acceptance coverage from master yet"
  exit 0
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
trap 'exit 1' INT TERM
gh api "repos/$GITHUB_REPOSITORY/actions/artifacts/$artifact_id/zip" > "$tmp/coverage.zip"
unzip -q "$tmp/coverage.zip" -d "$tmp"
mkdir -p "$(dirname "$dest")"
mv "$tmp/acceptance.coverage" "$dest"
echo "Downloaded acceptance coverage from artifact $artifact_id"
