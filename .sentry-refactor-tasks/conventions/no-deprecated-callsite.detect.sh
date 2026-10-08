#!/usr/bin/env bash
# Usage: no-deprecated-callsite.detect.sh <repo-path> [rule-id] [--baseline]
set -euo pipefail

repo_path="$1"
rule="${2:-typescript/no-deprecated}"
script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$repo_path"
repo_path="$PWD"
detector_log="$(mktemp)"
trap 'rm -f "$detector_log"' EXIT

# The scanner discards stderr; mirror failures and timing into the job summary.
report() {
  printf '%s\n' "$1" >&2
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '### refactor-tasks: %s\n\n```\n%s\n```\n' "$rule" "$1" \
      >>"$GITHUB_STEP_SUMMARY"
  fi
}

if ! raw="$(node "$script_dir/oxlint-json-runner.ts" \
  "$repo_path" "$rule" "${@:3}" 2>"$detector_log")"; then
  report "detector failed:
$(cat "$detector_log")"
  exit 1
fi
report "$(cat "$detector_log")"
if [ -z "$raw" ]; then
  report "detector exited 0 but wrote nothing; refusing to report a clean scan"
  exit 1
fi
printf '%s\n' "$raw"
