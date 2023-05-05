#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cd ..
gh repo clone https://github.com/getsentry/security-as-code /tmp/security-as-code
sha=$(git -C /tmp/security-as-code rev-parse @)
pip3 install pyyaml==6.0
./bin/react-to-product-owners-yml-changes.py /tmp/security-as-code/rbac/lib/product-owners.yml
branch="getsantry/update-product-areas-${sha:0:8}"
message="Sync with product-owners.yml in security-as-code@${sha:0:8}"
git checkout -b "$branch"
git add .
git commit -n -m "$message"
git push --set-upstream origin "$branch"
gh pr create --title "meta(routing) $message" --body="File: https://github.com/getsentry/security-as-code/blob/$sha/rbac/lib/product-owners.yml\n\nDocs: https://www.notion.so/473791bae5bf43399d46093050b77bf0"
gh pr merge --squash --auto
