#!/usr/bin/env bash
#
# Detector for the `no-derived-state` convention.
#
# This is where everything specific to the sentry repo and the
# eslint-plugin-react-you-might-not-need-an-effect plugin lives. The generic
# eslint-json-runner.ts sits alongside this script (so eslint stays out of the
# core scanner) and is located relative to this file.
#
# Usage: no-derived-state.detect.sh <repo-path>
#   <repo-path>  checkout of the target repo (cwd for pnpm/eslint)
#
# The scanner runs this in place against your working checkout, so the script
# is careful to leave the repo exactly as it found it: it snapshots package.json
# and pnpm-lock.yaml before pinning the plugin and restores them (plus removes
# the temp eslint config) on exit. The extra package left in node_modules is
# gitignored and harmless.
#
# All install/diagnostic output goes to stderr; only the runner's JSON reaches
# stdout, which the scanner parses.
set -euo pipefail

repo_path="$1"
script_dir="$(cd "$(dirname "$0")" && pwd)"
rule="react-you-might-not-need-an-effect/no-derived-state"
config_path="$repo_path/.no-derived-state.eslint.config.mjs"

cd "$repo_path"

# Snapshot the files `pnpm add` would mutate, and restore them on exit so the
# working tree is left clean. Done before any mutation; removes the temp config
# too.
pkg_backup="$(mktemp)"
lock_backup="$(mktemp)"
cp package.json "$pkg_backup"
cp pnpm-lock.yaml "$lock_backup"
cleanup() {
  mv -f "$pkg_backup" package.json
  mv -f "$lock_backup" pnpm-lock.yaml
  rm -f "$config_path"
}
trap cleanup EXIT

# Bring up the repo's toolchain, then pin the plugin to the version this
# convention's detection depends on — independent of the repo's own lockfile.
pnpm install --frozen-lockfile 1>&2
pnpm add -D eslint-plugin-react-you-might-not-need-an-effect@1.0.1 1>&2

# Write a standalone flat config that loads only this rule. Bypassing the
# repo's own eslint.config avoids failures from rule names that differ between
# plugin versions. It lives inside the repo so its imports resolve from the
# repo's node_modules (where the pinned plugin version is installed).
cat > "$config_path" <<'EOF'
import parser from '@typescript-eslint/parser';
import plugin from 'eslint-plugin-react-you-might-not-need-an-effect';
export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
    plugins: { 'react-you-might-not-need-an-effect': plugin },
    rules: { 'react-you-might-not-need-an-effect/no-derived-state': 'error' },
  },
];
EOF

pnpm exec node "$script_dir/eslint-json-runner.ts" "$repo_path" "$rule" "$config_path" static
