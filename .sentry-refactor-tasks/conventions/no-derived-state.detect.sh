#!/usr/bin/env bash
#
# Detector for the `no-derived-state` convention.
#
# This is where everything specific to the sentry repo and the
# eslint-plugin-react-you-might-not-need-an-effect plugin lives. The plugin runs
# as an oxlint JS plugin. The generic oxlint-json-runner.ts sits alongside this
# script and is located relative to this file.
#
# Usage: no-derived-state.detect.sh <repo-path>
#   <repo-path>  checkout of the target repo (cwd for pnpm/oxlint)
#
# The plugin is already a repo dependency, so this does NOT touch package.json /
# the lockfile. It only writes a temporary oxlint config and removes it on exit.
#
# All install/diagnostic output goes to stderr; only the runner's JSON reaches
# stdout, which the scanner parses.
set -euo pipefail

repo_path="$1"
script_dir="$(cd "$(dirname "$0")" && pwd)"
rule="react-you-might-not-need-an-effect/no-derived-state"
config_path="$repo_path/.no-derived-state.oxlintrc.json"

cd "$repo_path"

cleanup() {
  rm -f "$config_path"
}
trap cleanup EXIT

pnpm install --frozen-lockfile 1>&2

# Standalone config loading only this rule, so detection does not depend on the
# repo's own oxlint.config.ts. It lives in the repo root so the JS plugin
# resolves from the repo's node_modules.
cat > "$config_path" <<'EOF'
{
  "jsPlugins": ["eslint-plugin-react-you-might-not-need-an-effect"],
  "categories": {"correctness": "off"},
  "rules": {"react-you-might-not-need-an-effect/no-derived-state": "error"}
}
EOF

pnpm exec node "$script_dir/oxlint-json-runner.ts" "$repo_path" "$rule" "$config_path" static
