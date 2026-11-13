#!/bin/sh
# Waits until npm serves the version that a GitHub release published. Craft
# runs the github target before npm for static/packages/*, so the release can
# be published a few minutes before its npm version exists.
#
# Environment:
#   PACKAGE      The npm package name, such as @sentry/api.
#   RELEASE_TAG  The release tag, such as api@2.3.1.
#   TAG_PREFIX   The tag prefix in front of the version, such as api@.
set -eu

version=${RELEASE_TAG#"$TAG_PREFIX"}
attempt=0
while [ "$attempt" -lt 30 ]; do
  if found=$(timeout 30 npm view "$PACKAGE@$version" version 2>/dev/null) &&
    [ "$found" = "$version" ]; then
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 20
done

printf '%s@%s is not on npm after 10 minutes\n' "$PACKAGE" "$version" >&2
exit 1
