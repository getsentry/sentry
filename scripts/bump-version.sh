#!/bin/bash
set -eu

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# shellcheck disable=SC2034
OLD_VERSION="$1"
NEW_VERSION="$2"

sed -i -e 's/^version = .*$/version = '"$NEW_VERSION/" setup.cfg
# only bump this on tagged releases
if [[ "$NEW_VERSION" != *.dev0 ]]; then
  sed -i -e 's/^SELF_HOSTED_STABLE_VERSION = .*/SELF_HOSTED_STABLE_VERSION = "'"$NEW_VERSION"'"/' src/sentry/conf/server.py
fi

echo "New version: $NEW_VERSION"
