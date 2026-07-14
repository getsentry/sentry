#!/usr/bin/env bash
# Run one category from Oxlint's React Compiler analyzer and emit scanner JSON.
# Usage: react-compiler.detect.sh <repo-path> <category> [excluded-category,...]
set -euo pipefail

repo_path="$1"
category="$2"
excluded_categories="${3:-}"
excluded_detector="${4:-}"
script_dir="$(cd "$(dirname "$0")" && pwd)"
excluded_findings=""

cleanup() {
  if [[ -n "$excluded_findings" ]]; then
    rm -f "$excluded_findings"
  fi
}
trap cleanup EXIT

if [[ -n "$excluded_detector" ]]; then
  excluded_findings="$(mktemp)"
  bash "$script_dir/$excluded_detector" "$repo_path" > "$excluded_findings"
  export REACT_COMPILER_EXCLUDE_FINDINGS="$excluded_findings"
fi

pnpm --dir "$repo_path" exec node \
  "$script_dir/react-compiler-json-runner.ts" \
  "$repo_path" \
  "$category" \
  "$excluded_categories" \
  static/app
