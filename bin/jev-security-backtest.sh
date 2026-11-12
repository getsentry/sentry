#!/usr/bin/env bash
# Backtest the draft sentry-security Jev rules on existing code.
# Each rule only sees files that could contain its pattern (a grep prefilter),
# so the run costs a few thousand calls instead of ~17k.
# Usage: OPENROUTER_API_KEY=... bin/jev-security-backtest.sh [ruleName ...]
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
out=.artifacts/jev-backtest
mkdir -p "$out"
cfg=decisionModelLinter.securityDrafts.config.ts
skip='/tests/|/testutils/|/migrations/|new_migrations/|\.spec\.tsx?$|\.stories\.tsx$|__stories__'

candidates() {
  case "$1" in
    looksUpRequestIdWithoutOrgScope)
      git grep -lE 'request\.(GET|query_params|data)|validated_data' -- ':(glob)src/sentry/**/endpoints/**/*.py' ':(glob)src/sentry/api/**/*.py' ;;
    acceptsForeignKeyIdWithoutOrgValidation)
      git grep -lE '_id = serializers\.|Id = serializers\.|_ids = serializers\.|Ids = serializers\.' -- ':(glob)src/sentry/**/*.py' ;;
    usesActorFieldForOwnership)
      git grep -l 'ActorField' -- ':(glob)src/sentry/**/*.py' ;;
    checksSuperuserFlagInsteadOfSession)
      git grep -lE '\.is_(superuser|staff)\b' -- ':(glob)src/sentry/**/*.py' ;;
    changesRoleWithoutHierarchyCheck)
      git grep -lE '\.role\s*=|[^_]role=|team_role' -- ':(glob)src/sentry/**/*.py' ;;
    rendersUnsanitizedHtml)
      git grep -lE 'dangerouslySetInnerHTML|innerHTML' -- ':(glob)static/app/**/*.ts*' ':(glob)static/gsApp/**/*.ts*' ;;
  esac | grep -vE "$skip"
}

rules=("$@")
[ ${#rules[@]} -eq 0 ] && rules=(
  usesActorFieldForOwnership checksSuperuserFlagInsteadOfSession rendersUnsanitizedHtml
  changesRoleWithoutHierarchyCheck acceptsForeignKeyIdWithoutOrgValidation looksUpRequestIdWithoutOrgScope
)

for rule in "${rules[@]}"; do
  mapfile -t files < <(candidates "$rule")
  echo "$rule: ${#files[@]} files" >&2
  [ ${#files[@]} -eq 0 ] && continue
  pnpm exec decision-model-linter --config "$cfg" --suite "$rule" --format json -- "${files[@]}" \
    > "$out/$rule.json"
  # path + finding probability, for review
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const hits = r.filter(f => f.findings.length);
    const errs = r.filter(f => f.error);
    console.error(`  findings: ${hits.length}/${r.length}  errors: ${errs.length}`);
    for (const f of hits) console.log(`${process.argv[2]}\t${f.path}\t${JSON.stringify(f.answers)}`);
  ' "$out/$rule.json" "$rule" >> "$out/findings.tsv"
done
echo "Findings to review: $out/findings.tsv" >&2
