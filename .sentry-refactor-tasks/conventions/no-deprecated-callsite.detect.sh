#!/usr/bin/env bash
#
# Detector for the `no-deprecated-callsite` convention.
#
# Flags every callsite that references an `@deprecated` symbol, using the
# type-aware oxlint rule `typescript/no-deprecated` (backed by oxlint-tsgolint).
# Because the rule resolves each symbol through the TypeScript checker, its
# message includes the symbol's own `@deprecated` JSDoc text (the migration
# instruction) — which the scanner surfaces as the finding's explanation.
#
# It does NOT add any package and does NOT touch package.json / the lockfile.
# It only writes a temporary oxlint config and removes it on exit.
#
# Usage: no-deprecated-callsite.detect.sh <repo-path>
#   <repo-path>  checkout of the target repo (cwd for pnpm/oxlint)
#
# All install/diagnostic output goes to stderr; only the runner's JSON reaches
# stdout, which the scanner parses.
set -euo pipefail

repo_path="$1"
script_dir="$(cd "$(dirname "$0")" && pwd)"
rule="typescript/no-deprecated"
config_path="$repo_path/.no-deprecated-callsite.oxlintrc.json"

cd "$repo_path"

detector_log="$(mktemp)"

# Only the temp config is created; nothing else in the tree is mutated.
cleanup() {
  rm -f "$config_path" "$detector_log"
}
trap cleanup EXIT

# The scanner captures and discards this script's stderr, so a failure written
# there alone is invisible in CI logs — which is how this convention reported a
# clean zero on every scheduled run for weeks. Mirror diagnostics into the job
# summary when running under GitHub Actions so the reason is actually readable.
report() {
  printf '%s\n' "$1" >&2
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '### refactor-tasks: no-deprecated-callsite\n\n```\n%s\n```\n' "$1" \
      >>"$GITHUB_STEP_SUMMARY"
  fi
}

# Bring up the repo's toolchain. No `pnpm add` — oxlint and oxlint-tsgolint are
# already repo dependencies, so the working tree stays clean.
if ! pnpm install --frozen-lockfile 1>&2; then
  report "pnpm install --frozen-lockfile failed; cannot lint without the repo toolchain"
  exit 1
fi

# Standalone config loading only this rule, so none of the repo's other
# type-aware rules add to the run time. It lives in the repo root because oxlint
# treats files outside a config's directory as ignored.
cat > "$config_path" <<'EOF'
{
  "plugins": ["typescript"],
  "categories": {"correctness": "off"},
  "options": {"typeAware": true},
  "rules": {"typescript/no-deprecated": "error"}
}
EOF

# Emit only callsites whose deprecation note carries a migration instruction —
# i.e. `@deprecated` text beyond the bare "`<name>` is deprecated." A bare
# deprecation gives a caller nothing to act on (that gap is the
# `deprecated-needs-replacement` convention's concern), so drop those here and
# report only the instances we can actually tell Seer how to fix.
#
# Run the detector on its own rather than piping it straight into the filter.
# As a pipeline, a detector that died before writing anything reached the filter
# as empty input, and the filter's `JSON.parse(data || "[]")` turned that into a
# valid empty result — so "the linter never ran" and "the codebase is clean"
# were indistinguishable downstream. Capture the output, then decide.
if ! raw="$(pnpm exec node "$script_dir/oxlint-json-runner.ts" \
  "$repo_path" "$rule" "$config_path" static 2>"$detector_log")"; then
  report "detector failed:
$(cat "$detector_log")"
  exit 1
fi

# Mirror the successful run's counts and timing too, not just failures: knowing
# how close the run came to the scanner's 300s kill is what tells us whether a
# future empty result was a timeout.
report "$(cat "$detector_log")"

if [ -z "$raw" ]; then
  report "detector exited 0 but wrote nothing; refusing to report a clean scan"
  exit 1
fi

printf '%s' "$raw" | node --input-type=module -e '
      let data = "";
      process.stdin.on("data", chunk => (data += chunk));
      process.stdin.on("end", () => {
        // No `|| "[]"` fallback here: empty input means the detector broke, and
        // an exception is the signal we want rather than a clean empty result.
        const files = JSON.parse(data);
        const hasInstruction = m => /is deprecated\.\s*\S/.test(m.message);
        const filtered = files
          .map(f => ({...f, messages: f.messages.filter(hasInstruction)}))
          .filter(f => f.messages.length > 0);
        process.stdout.write(JSON.stringify(filtered));
      });
    '
