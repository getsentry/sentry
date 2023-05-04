#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cd ..
gh repo clone https://github.com/getsentry/security-as-code /tmp/security-as-code
sha=$(git -C /tmp/security-as-code rev-parse @)
pip3 install pyyaml==6.0
./bin/react-to-product-owners-yml-changes.py /tmp/security-as-code/rbac/lib/product-owners.yml
branch="getsantry/update-product-area-labels-${sha:0:8}"
git checkout -b "$branch"
git add .
git commit -m "Sync with product-owners.yml in security-as-code@${sha:0:8}"
git push --set-upstream origin "$branch"
gh pr create --fill
gh pr merge --squash --auto
