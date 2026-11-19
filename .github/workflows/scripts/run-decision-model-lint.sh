#!/bin/sh
# Lints the PR's changes (HEAD^1..HEAD) with decision-model-linter, writes the
# report to the job summary, and creates, updates, or clears the PR comment
# that holds it. Exits with the linter's status, or 0 when OVERRIDDEN is true.
# Reads PR, LABEL, and OVERRIDDEN, plus GH_TOKEN and OPENROUTER_API_KEY for the
# gh and linter calls.
set -eu

report="$RUNNER_TEMP/decision-model-lint.md"
status=0
pnpm exec decision-model-linter --config decisionModelLinter.config.ts \
  --base HEAD^1 --format markdown > "$report" || status=$?

# Only 1 means findings; any other failure means the linter did not finish.
if [ "$status" -eq 1 ] && [ "$OVERRIDDEN" = true ]; then
  printf "\\nThe \`%s\` label keeps these errors from failing the check.\\n" "$LABEL" >> "$report"
elif [ "$status" -eq 1 ]; then
  printf "\\nThese errors fail the check; fix the code to resolve them. If you and a reviewer are confident an error is wrong, a person can add the \`%s\` label to pass the check while the findings stay reported. Agents should never add this label.\\n" "$LABEL" >> "$report"
elif [ "$status" -gt 1 ] && [ "$OVERRIDDEN" = true ]; then
  printf "The linter did not finish (exit %s), and the \`%s\` label passes the check anyway; see the job log.\\n" "$status" "$LABEL" >> "$report"
fi

cat "$report" >> "$GITHUB_STEP_SUMMARY"

marker='<!-- decision-model-linter -->'
comment=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" --paginate \
  --jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body | contains(\"$marker\"))) | .id" | head -n 1)
# gh reads the body from a file, because Linux limits one argument to 128 KiB.
body="$RUNNER_TEMP/decision-model-lint-comment.md"
if [ -s "$report" ] && { [ "$status" -le 1 ] || [ "$OVERRIDDEN" = true ]; }; then
  printf '%s\n' "$marker" > "$body"
  # GitHub rejects comments over 65536 characters, and bytes never undercount characters.
  report_bytes=$(wc -c < "$report")
  if [ "$report_bytes" -gt 60000 ]; then
    # Drop the line that the cut can split. Keep the last line: the note above, or the usage.
    {
      head -c 60000 "$report" | sed '$d'
      printf '\nThe report is too long for a comment. The [job summary](%s) has the full report.\n\n' \
        "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
      tail -n 1 "$report"
    } >> "$body"
  else
    cat "$report" >> "$body"
  fi
elif [ "$status" -eq 0 ] && [ -n "$comment" ]; then
  printf '%s\nNo findings on the latest commit.\n' "$marker" > "$body"
fi
if [ -s "$body" ] && [ -n "$comment" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$comment" -F body=@"$body" > /dev/null
elif [ -s "$body" ]; then
  gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" -F body=@"$body" > /dev/null
fi

if [ "$status" -ne 0 ] && [ "$OVERRIDDEN" = true ]; then exit 0; fi
exit "$status"
