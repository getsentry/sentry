#!/usr/bin/env bash
#
# Detector for the `no-any-callsite` convention.
#
# Flags TypeScript type-safety escape hatches across the frontend codebase:
# explicit `any` usage (annotations, `as any`, `any[]`, `Array<any>`,
# `Record<string, any>`, `Promise<any>`, and `Foo<any>` generic type
# arguments) plus compiler-suppression comments (`@ts-ignore`,
# `@ts-expect-error`, `@ts-nocheck`). This is pure grep, not a type-aware analysis — it cannot see
# inferred `any` (e.g. an untyped third-party import flowing through) or
# widened `any` from a missing type on a boundary. That's a real gap; a
# type-aware detector (in the spirit of no-deprecated-callsite's
# `@typescript-eslint/no-unsafe-*` rules) would be needed to close it, and is
# out of scope here.
#
# Emits a JSON array on stdout, one object per hit:
#   {"file": "...", "line": N, "category": "...", "context": "..."}
# `category` is one of: ts-nocheck, ts-expect-error, ts-ignore, any-array,
# any-record, any-promise, any-as, any-generic-arg, any-annotation.
# All diagnostics go to stderr.
#
# Usage: no-any-callsite.detect.sh <repo-path>
#   <repo-path>  checkout of the target repo (scanned at <repo-path>/static)
set -euo pipefail

repo_path="$1"
static_dir="$repo_path/static"

echo "Scanning $static_dir for TypeScript any-usage and suppression comments..." 1>&2

# Candidate lines: anything that could plausibly be one of our categories.
# Kept broad on purpose - exact classification happens in the python pass
# below, in priority order, so a line matching more than one shape (e.g.
# "state: any[]") is only counted once, under its most specific category.
pattern='@ts-nocheck|@ts-expect-error|@ts-ignore|\bany\[\]|Array<\s*any\s*>|Record<\s*string\s*,\s*any\s*>|Promise<\s*any\s*>|\bas\s+any\b|<any>|:\s*any\b'

if command -v rg >/dev/null 2>&1; then
  matches=$(rg -n --no-heading --no-config -e "$pattern" \
    -g '*.ts' -g '*.tsx' \
    -g '!**/node_modules/**' -g '!**/__mocks__/**' -g '!**/__fixtures__/**' \
    -g '!**/*.spec.*' -g '!**/*.test.*' -g '!**/test/**' \
    "$static_dir" || true)
else
  matches=$(grep -rn -E --include='*.ts' --include='*.tsx' -e "$pattern" "$static_dir" \
    | grep -v -E '/(node_modules|__mocks__|__fixtures__|test)/' \
    | grep -v -E '\.(spec|test)\.' || true)
fi

hit_count=$(printf '%s\n' "$matches" | grep -c . || true)
echo "Found $hit_count candidate line(s); classifying each..." 1>&2

# Parse each "file:line:content" match into {file, line, category, context}.
# Passed via process substitution (a filename), not `python3 - <<PYEOF`,
# because a heredoc attached to the same command would redirect stdin too -
# that would swallow the piped match data instead of leaving it for the
# script's own `sys.stdin` read.
printf '%s\n' "$matches" | python3 <(cat <<'PYEOF'
import json
import re
import sys

repo_path = sys.argv[1]

# Checked in order; first match wins, so a line matching more than one shape
# (e.g. "state: any[]" also trips the bare ": any" pattern) is classified
# under its most specific category rather than double-counted.
PATTERNS = [
    ('ts-nocheck', re.compile(r'@ts-nocheck\b')),
    ('ts-expect-error', re.compile(r'@ts-expect-error\b')),
    ('ts-ignore', re.compile(r'@ts-ignore\b')),
    ('any-array', re.compile(r'\bany\[\]|\bArray<\s*any\s*>')),
    ('any-record', re.compile(r'\bRecord<\s*string\s*,\s*any\s*>')),
    ('any-promise', re.compile(r'\bPromise<\s*any\s*>')),
    ('any-as', re.compile(r'\bas\s+any\b')),
    # `Foo<any>` generic type arguments (including the rare prefix-cast form
    # `<any>value`). Angle brackets collide with JSX syntax, so this category
    # is only ever matched for .ts files - the .tsx guard lives in the loop
    # below.
    ('any-generic-arg', re.compile(r'<any>')),
    ('any-annotation', re.compile(r':\s*any\b')),
]

findings = []
for raw_line in sys.stdin:
    line = raw_line.rstrip('\n')
    if not line:
        continue
    # file paths may contain ':' (rare), so split only on the first two
    # colons after stripping the repo prefix rg/grep printed.
    try:
        file_part, lineno_part, content = line.split(':', 2)
    except ValueError:
        continue

    is_tsx = file_part.endswith('.tsx')

    category = None
    for cat, pattern in PATTERNS:
        if cat == 'any-generic-arg' and is_tsx:
            continue
        if pattern.search(content):
            category = cat
            break

    if category is None:
        continue

    rel_file = file_part[len(repo_path) + 1 :] if file_part.startswith(repo_path) else file_part
    findings.append(
        {
            'file': rel_file,
            'line': int(lineno_part),
            'category': category,
            'context': content.strip(),
        }
    )

json.dump(findings, sys.stdout)
print()
PYEOF
) "$repo_path"
