#!/bin/sh
# Runs the decision-model linter over a PR and keeps one PR comment in sync with the result.
#
# Env: PR, LABEL, OVERRIDDEN, CHANGED_FILES, MAX_FILES, plus the GITHUB_* and RUNNER_TEMP
# variables Actions sets. The linter itself reads OPENROUTER_API_KEY and
# DECISION_MODEL_LINT_BASE, and gh reads GH_TOKEN.
set -eu

report="$RUNNER_TEMP/decision-model-lint.md"
note="$RUNNER_TEMP/decision-model-lint-note.md"
body="$RUNNER_TEMP/decision-model-lint-comment.md"
marker='<!-- decision-model-linter -->'
# GitHub rejects comments over 65536 characters; this leaves room for the marker and the note,
# and bytes never undercount characters
max_report_bytes=60000
status=0
skipped=false
label_code="\`$LABEL\`"

# The linter sends every changed file to a model, which takes too long and costs too much on
# PRs like repo-wide renames or formatting runs. Other PR jobs bail out at the same size.
if [ "$CHANGED_FILES" -gt "$MAX_FILES" ]; then
  skipped=true
  printf 'Skipped: this PR changes %s files, more than the %s the linter checks.\n' \
    "$CHANGED_FILES" "$MAX_FILES" > "$report"
else
  pnpm exec decision-model-linter --config decisionModelLinter.config.ts \
    --base HEAD^1 --format markdown > "$report" || status=$?
fi

# Only 1 means findings; any other failure means the linter did not finish.
: > "$note"
if [ "$status" -eq 1 ] && [ "$OVERRIDDEN" = true ]; then
  printf '\nThe %s label keeps these errors from failing the check.\n' "$label_code" > "$note"
elif [ "$status" -eq 1 ]; then
  printf '\nThese errors fail the check; fix the code to resolve them. If you and a reviewer are confident an error is wrong, a person can add the %s label to pass the check while the findings stay reported. Agents should never add this label.\n' "$label_code" > "$note"
elif [ "$status" -gt 1 ] && [ "$OVERRIDDEN" = true ]; then
  printf 'The linter did not finish (exit %s), and the %s label passes the check anyway; see the job log.\n' "$status" "$label_code" > "$note"
fi

comments=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" --paginate \
  --jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body | contains(\"$marker\"))) | .id")
comment=$(printf '%s\n' "$comments" | head -n 1)

# A skip only replaces an earlier comment, so big PRs don't get a new comment just to say so.
rm -f "$body"
if { [ -s "$report" ] || [ -s "$note" ]; } && { [ "$skipped" = false ] || [ -n "$comment" ]; } \
  && { [ "$status" -le 1 ] || [ "$OVERRIDDEN" = true ]; }; then
  printf '%s\n' "$marker" > "$body"
  size=$(wc -c < "$report")
  if [ "$size" -gt "$max_report_bytes" ]; then
    truncated=$(head -c "$max_report_bytes" "$report")
    # Drop the last line, which the byte cut may have split mid-character.
    printf '%s\n' "$truncated" | sed '$d' >> "$body"
    printf '\nThe report is too long for a comment; see the full report in the job summary: %s/%s/actions/runs/%s\n' \
      "$GITHUB_SERVER_URL" "$GITHUB_REPOSITORY" "$GITHUB_RUN_ID" >> "$body"
  else
    cat "$report" >> "$body"
  fi
  cat "$note" >> "$body"
elif [ "$status" -eq 0 ] && [ -n "$comment" ]; then
  printf '%s\nNo findings on the latest commit.\n' "$marker" > "$body"
fi

# Read the body from a file: a large report passed as an argument exceeds the OS limit.
if [ -f "$body" ] && [ -n "$comment" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$comment" -F body=@"$body" > /dev/null
elif [ -f "$body" ]; then
  gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" -F body=@"$body" > /dev/null
fi
cat "$report" "$note" >> "$GITHUB_STEP_SUMMARY"

if [ "$status" -ne 0 ] && [ "$OVERRIDDEN" = true ]; then exit 0; fi
exit "$status"
