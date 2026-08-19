#!/usr/bin/env bash
#
# Detector for the `no-unjustified-lint-ignore` convention.
#
# Flags inline lint-suppression comments — eslint-disable*, oxlint-disable*,
# and biome-ignore* — across the frontend codebase. This is pure grep, not a
# linter run: the target is the ignore *comment* itself (a callsite that opts
# out of a rule), not a lint violation, so there is nothing to execute.
#
# Emits a JSON array on stdout, one object per hit:
#   {"file": "...", "line": N, "tool": "eslint"|"oxlint"|"biome", "rules": [...]}
# `rules` is empty for a bare `eslint-disable`/`oxlint-disable` (no rule name
# listed — suppresses everything on that line/block, so there's no single
# rule to look up docs for). All diagnostics go to stderr.
#
# Usage: no-unjustified-lint-ignore.detect.sh <repo-path>
#   <repo-path>  checkout of the target repo (scanned at <repo-path>/static)
set -euo pipefail

repo_path="$1"
static_dir="$repo_path/static"

echo "Scanning $static_dir for lint-ignore comments..." 1>&2

if command -v rg >/dev/null 2>&1; then
  matches=$(rg -n --no-heading --no-config \
    -e 'eslint-disable' -e 'oxlint-disable' -e 'biome-ignore' \
    -g '*.ts' -g '*.tsx' -g '*.js' -g '*.jsx' \
    -g '!**/node_modules/**' -g '!**/__mocks__/**' -g '!**/__fixtures__/**' \
    -g '!**/*.spec.*' -g '!**/*.test.*' -g '!**/test/**' \
    "$static_dir" || true)
else
  matches=$(grep -rn -E \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    -e 'eslint-disable' -e 'oxlint-disable' -e 'biome-ignore' "$static_dir" \
    | grep -v -E '/(node_modules|__mocks__|__fixtures__|test)/' \
    | grep -v -E '\.(spec|test)\.' || true)
fi

hit_count=$(printf '%s\n' "$matches" | grep -c . || true)
echo "Found $hit_count candidate line(s); parsing tool/rule out of each..." 1>&2

# Parse each "file:line:content" match into {file, line, tool, rules}. Kept as
# a plain Python filter (not a separate script) so this convention stays a
# single self-contained pair of files, mirroring how no-deprecated-callsite's
# detector embeds its Node filter inline.
#
# The script body is passed via process substitution (a filename), not `python3
# - <<PYEOF`, because a heredoc attached to the same command redirects stdin
# too — that would swallow the piped match data instead of leaving it for the
# script's own `sys.stdin` read.
printf '%s\n' "$matches" | python3 <(cat <<'PYEOF'
import json
import re
import sys

repo_path = sys.argv[1]

RULE_TOKEN = r'[A-Za-z0-9_@./-]+'
RULES_LIST = rf'{RULE_TOKEN}(?:\s*,\s*{RULE_TOKEN})*'

# Order matters within a tool: the "-line"/"-next-line" variants are checked
# implicitly via the negative lookahead on the bare pattern, so a single pass
# per tool is enough — each line matches at most one pattern.
PATTERNS = [
    ('eslint', re.compile(rf'\beslint-disable-next-line\b[ \t]*({RULES_LIST})?')),
    ('eslint', re.compile(rf'\beslint-disable-line\b[ \t]*({RULES_LIST})?')),
    ('eslint', re.compile(rf'\beslint-disable(?!-(?:next-)?line)\b[ \t]*({RULES_LIST})?')),
    ('oxlint', re.compile(rf'\boxlint-disable-next-line\b[ \t]*({RULES_LIST})?')),
    ('oxlint', re.compile(rf'\boxlint-disable-line\b[ \t]*({RULES_LIST})?')),
    ('oxlint', re.compile(rf'\boxlint-disable(?!-(?:next-)?line)\b[ \t]*({RULES_LIST})?')),
    ('biome', re.compile(rf'\bbiome-ignore-all\b[ \t]+lint/({RULE_TOKEN})\s*:')),
    ('biome', re.compile(rf'\bbiome-ignore\b[ \t]+lint/({RULE_TOKEN})\s*:')),
]

findings = []
for raw_line in sys.stdin:
    line = raw_line.rstrip('\n')
    if not line:
        continue
    # file paths may contain ':' (rare), so split only on the first two colons
    # after stripping the repo prefix rg/grep printed.
    try:
        file_part, lineno_part, content = line.split(':', 2)
    except ValueError:
        continue

    tool = None
    rules: list[str] = []
    for pattern_tool, pattern in PATTERNS:
        m = pattern.search(content)
        if m:
            tool = pattern_tool
            if m.group(1):
                rules = [r.strip() for r in m.group(1).split(',') if r.strip()]
            break

    if tool is None:
        continue

    rel_file = file_part[len(repo_path) + 1 :] if file_part.startswith(repo_path) else file_part
    findings.append(
        {
            'file': rel_file,
            'line': int(lineno_part),
            'tool': tool,
            'rules': rules,
            'context': content.strip(),
        }
    )

json.dump(findings, sys.stdout)
print()
PYEOF
) "$repo_path"
