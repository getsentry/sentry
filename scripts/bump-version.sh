#!/bin/sh
set -eu

script_dir=$(dirname "$0")
cd "$script_dir/.."

# shellcheck disable=SC2034
OLD_VERSION="$1"
NEW_VERSION="$2"

sed -i -e 's/^VERSION = .*$/VERSION = "'"$NEW_VERSION"'"/' src/sentry/__init__.py
# tools/fast_editable.py still reads this until getsentry stops using it.
sed -i -e 's/^version = .*$/version = '"$NEW_VERSION/" setup.cfg
# only bump this on tagged releases
case "$NEW_VERSION" in
*.dev0) ;;
*) sed -i -e 's/^SELF_HOSTED_STABLE_VERSION = .*/SELF_HOSTED_STABLE_VERSION = "'"$NEW_VERSION"'"/' src/sentry/conf/server.py ;;
esac

echo "New version: $NEW_VERSION"
