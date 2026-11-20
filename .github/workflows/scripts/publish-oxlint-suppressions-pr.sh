#!/bin/sh
# Pushes changed oxlint-suppressions.json files to the
# bot/prune-oxlint-suppressions branch as BOT_LOGIN, and opens a pull request
# for them unless one is already open. Does nothing when none changed.
set -eu

if git diff --quiet -- oxlint-suppressions.json '**/oxlint-suppressions.json'; then
  exit 0
fi
gh auth setup-git
BOT_ID=$(gh api "users/$BOT_LOGIN" --jq .id)
git config user.name "$BOT_LOGIN"
git config user.email "$BOT_ID+$BOT_LOGIN@users.noreply.github.com"
BRANCH="bot/prune-oxlint-suppressions"
git switch -C "$BRANCH"
git add -u -- ':(glob)**/oxlint-suppressions.json'
git commit -m "chore(lint): prune oxlint suppressions"
git push -f origin "$BRANCH"
PR=$(gh pr list --base master --head "$BRANCH" --state open --json number --jq '.[0].number // empty')
if [ -z "$PR" ]; then
  gh pr create --base master --head "$BRANCH" \
    --title "chore(lint): prune oxlint suppressions" \
    --body "Reduce stale suppression budgets with \`pnpm run lint:suppressions --prune\`."
fi
