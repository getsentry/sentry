#!/bin/bash
set -eu

git checkout master && git pull
# shellcheck disable=SC2001
./scripts/bump-version.sh '' "$(date -d "$(echo "$CRAFT_NEW_VERSION" | sed -e 's/^\([0-9]\{2\}\)\.\([0-9]\{1,2\}\)\.[0-9]\+$/20\1-\2-1/') 1 month" +%y.%-m.0.dev0)"
git diff --quiet || git commit -anm 'meta: Bump new development version' && git pull --rebase && git push
