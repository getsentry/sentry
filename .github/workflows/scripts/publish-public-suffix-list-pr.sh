#!/bin/sh
# Pushes a changed PSL_PATH to the bot/update-public-suffix-list branch as
# BOT_LOGIN, and opens a pull request for it unless one is already open.
# Does nothing when PSL_PATH is unchanged.
set -eu

if git diff --quiet -- "$PSL_PATH"; then
  exit 0
fi
gh auth setup-git
BOT_ID=$(gh api "users/$BOT_LOGIN" --jq .id)
git config user.name "$BOT_LOGIN"
git config user.email "$BOT_ID+$BOT_LOGIN@users.noreply.github.com"
BRANCH="bot/update-public-suffix-list"
git switch -C "$BRANCH"
git add -- "$PSL_PATH"
git commit -m "chore(uptime): Update public suffix list"
git push -f origin "$BRANCH"
PR=$(gh pr list --base master --head "$BRANCH" --state open --json number --jq '.[0].number // empty')
if [ -z "$PR" ]; then
  gh pr create --base master --head "$BRANCH" \
    --title "chore(uptime): Update public suffix list" \
    --body 'Weekly copy of https://publicsuffix.org/list/public_suffix_list.dat, which uptime uses to find the domain and suffix of a URL.'
fi
