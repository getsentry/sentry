#!/bin/sh
# Pushes the updated pnpm-lock.yaml to the chore/update-baseline branch, and
# opens a pull request for it unless one is already open.
set -eu

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
BRANCH="chore/update-baseline"
git switch -C "$BRANCH"
git add pnpm-lock.yaml
git commit -m "chore(deps): update baseline-browser-mapping"
git push -f origin "$BRANCH"
# Create PR only if one doesn't already exist
if ! gh pr list --head "$BRANCH" --state open | grep -q .; then
  gh pr create \
    --title "chore(deps): update baseline-browser-mapping" \
    --body "automated update of [\`baseline-browser-mapping\`](https://npmx.dev/package/baseline-browser-mapping) to suppress stale-data console warnings"
fi
