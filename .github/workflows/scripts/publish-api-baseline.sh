#!/bin/sh
# Publish the scan job's exceptions.json as a bot PR when its entries changed.
# Used by .github/workflows/refresh-api-baseline.yml.
#
# env:
#   NEW_BASELINE  the exceptions.json the scan job uploaded
#   GH_TOKEN      the internal bot's token read by gh
#   BOT_LOGIN     the bot's login i.e "<app-slug>[bot]"
set -eu

BASELINE=api_exceptions/exceptions.json
BRANCH=bot/update-api-baseline
TITLE="chore(apidocs): Update the API exceptions baseline"

if ! jq -e '(.version | type == "number") and (.entries | type == "array")' "$NEW_BASELINE" >/dev/null; then
  echo "$NEW_BASELINE is not an exceptions file (needs a number version and an entries array)" >&2
  exit 1
fi

OLD_ENTRIES=$(jq -eS .entries "$BASELINE")
NEW_ENTRIES=$(jq -eS .entries "$NEW_BASELINE")
if [ "$OLD_ENTRIES" = "$NEW_ENTRIES" ]; then
  echo "entries unchanged, nothing to publish"
  exit 0
fi

cp "$NEW_BASELINE" "$BASELINE"

gh auth setup-git
BOT_ID=$(gh api "users/$BOT_LOGIN" --jq .id)
git config user.name "$BOT_LOGIN"
git config user.email "$BOT_ID+$BOT_LOGIN@users.noreply.github.com"
git switch -C "$BRANCH"
git add "$BASELINE"
git commit -m "$TITLE"
git push -f origin "$BRANCH"

# the force-push above already updated an open PR, so only open one when there isn't
PR=$(gh pr list --base master --head "$BRANCH" --state open --json number --jq '.[0].number // empty')
if [ -z "$PR" ]; then
  gh pr create --base master --head "$BRANCH" --title "$TITLE" --body-file - <<'EOF'
Daily refresh of `api_exceptions/exceptions.json`, from `make api-baseline ARGS="--update"` on master. Reviewed `status` and `reason` values are kept.

How to read the diff:

- **Removed entry:** the violation was fixed
- **New entry:** a violation added since the last refresh. If a file was renamed, its entries show up as new - the scan job's log prints a "Possibly moved" warning for those
- **Changed `count`:** more or fewer findings with the same rule, path, scope, and key
- **Changed `owner`:** the endpoint moved to another team
- **`generated` and `commit`** change on every run, ignore them

New entries get the reason "new since the baseline". They're tracked for now, and new violations will be blocked at the PR later, so merging this doesn't mean they're accepted for good.

Merging this updates the report card
EOF
fi
