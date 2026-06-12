#!/usr/bin/env bash
set -euo pipefail

# Decides whether a frontend CI job can scope to just the files a PR touches, or must run
# over everything. Prints two key=value lines on stdout:
#
#   merge_base=<sha>    the PR fork point (empty when it can't be determined)
#   scope=scoped|full   scoped when a merge base resolved AND every changed file is
#                       under static/; full otherwise
#
# We can only scope safely when both hold: tools that select work from the changed file
# set seed on source files and can't trace the impact of global config or dependency
# changes (eslint.config.ts, package.json, etc.), so any non-static change forces a full
# run. Non-PR events and missing history also fall back to full via git-merge-base.sh.
#
# The output format is consumable two ways: append it to $GITHUB_OUTPUT from an inline
# step, or `eval "$(...)"` it to set merge_base/scope shell variables in a calling script.
# Human-readable diagnostics go to stderr so they don't pollute either consumer.

MERGE_BASE=$(./.github/workflows/scripts/git-merge-base.sh)

if [ -z "$MERGE_BASE" ]; then
  echo "No merge base — running over all files" >&2
  echo "merge_base="
  echo "scope=full"
elif git diff --name-only "$MERGE_BASE" HEAD^2 | grep -qvE '^static/'; then
  echo "Non-static file changed — running over all files" >&2
  echo "merge_base=$MERGE_BASE"
  echo "scope=full"
else
  echo "Merge base: $MERGE_BASE — running over impacted files only" >&2
  echo "merge_base=$MERGE_BASE"
  echo "scope=scoped"
fi
