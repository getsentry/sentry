#!/bin/sh
# Prints, as GITHUB_OUTPUT lines, the base SHA of a merge group and the files
# the group changes, which getsentry selects tests from.
#
# A merge group branch is named gh-readonly-queue/<base branch>/pr-<number>-<base sha>.
set -eu

fail() {
  printf '::error::%s\n' "$1" >&2
  exit 1
}

case $MERGE_GROUP_BRANCH in
  gh-readonly-queue/*/pr-*-*) ;;
  *) fail "$MERGE_GROUP_BRANCH is not a merge group branch" ;;
esac

base_sha=${MERGE_GROUP_BRANCH##*-}
case $base_sha in
  *[!0-9a-f]*) base_is_hex=false ;;
  *) base_is_hex=true ;;
esac
if [ "$base_is_hex" = false ] || [ "${#base_sha}" -ne 40 ]; then
  fail "No base SHA in merge group branch $MERGE_GROUP_BRANCH"
fi

# The checkout holds master, not the merge group.
timeout 120 git fetch --no-tags --depth=1 origin "$base_sha" "$MERGE_GROUP_HEAD_SHA" >&2

printf 'base-sha=%s\n' "$base_sha"
exec python3 "$(dirname "$0")/parse-pr-files.py" --git-diff "$base_sha" "$MERGE_GROUP_HEAD_SHA"
