#!/usr/bin/env bash
#
# Detector for the `no-deprecated-callsite` convention.
#
# Flags every callsite that references an `@deprecated` symbol, using the
# type-aware `@typescript-eslint/no-deprecated` rule. Because the rule resolves
# each symbol through the TypeScript checker, its message includes the symbol's
# own `@deprecated` JSDoc text (the migration instruction) — which the scanner
# surfaces as the finding's explanation.
#
# Unlike no-derived-state, this reuses the plugin already installed in the repo
# (@typescript-eslint, which ships the no-deprecated rule), so it does NOT add
# any package and does NOT touch package.json / the lockfile. It only writes a
# temporary flat eslint config and removes it on exit.
#
# Usage: no-deprecated-callsite.detect.sh <repo-path>
#   <repo-path>  checkout of the target repo (cwd for pnpm/eslint)
#
# All install/diagnostic output goes to stderr; only the runner's JSON reaches
# stdout, which the scanner parses.
set -euo pipefail

repo_path="$1"
script_dir="$(cd "$(dirname "$0")" && pwd)"
rule="@typescript-eslint/no-deprecated"
config_path="$repo_path/.no-deprecated-callsite.eslint.config.mjs"

cd "$repo_path"

# Only the temp config is created; nothing else in the tree is mutated.
cleanup() {
  rm -f "$config_path"
}
trap cleanup EXIT

# Bring up the repo's toolchain. No `pnpm add` — the no-deprecated rule ships
# with the repo's own @typescript-eslint, so the working tree stays clean.
pnpm install --frozen-lockfile 1>&2

# Standalone flat config loading only this rule. It lives inside the repo so its
# imports resolve from the repo's node_modules, and `projectService` discovers
# the root tsconfig.json (tsconfigRootDir = this config's dir = repo root). The
# rule is type-aware, so type information is required — hence projectService.
cat > "$config_path" <<'EOF'
import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { '@typescript-eslint': plugin },
    rules: { '@typescript-eslint/no-deprecated': 'error' },
  },
];
EOF

# Type-aware linting across all of static/ builds a large type graph — give the
# eslint process extra heap so it does not OOM on a repo this size.
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=8192"

# Emit only callsites whose deprecation note carries a migration instruction —
# i.e. `@deprecated` text beyond the bare "`<name>` is deprecated." A bare
# deprecation gives a caller nothing to act on (that gap is the
# `deprecated-needs-replacement` convention's concern), so drop those here and
# report only the instances we can actually tell Seer how to fix.
pnpm exec node "$script_dir/eslint-json-runner.ts" "$repo_path" "$rule" "$config_path" static \
  | node --input-type=module -e '
      let data = "";
      process.stdin.on("data", chunk => (data += chunk));
      process.stdin.on("end", () => {
        const files = JSON.parse(data || "[]");
        const hasInstruction = m => /is deprecated\.\s*\S/.test(m.message);
        const filtered = files
          .map(f => ({...f, messages: f.messages.filter(hasInstruction)}))
          .filter(f => f.messages.length > 0);
        process.stdout.write(JSON.stringify(filtered));
      });
    '
