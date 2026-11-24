#!/bin/sh
# Waits until npm serves the @sentry/api version of an api@x.y.z release tag,
# so downstream bump workflows don't read the previous version. Craft publishes
# to npm before the GitHub release, but the registry can take a few minutes to
# serve a new version.
#
# Usage: wait-for-api-release-on-npm.sh api@x.y.z
# NPM_WAIT_ATTEMPTS (default 20) and NPM_WAIT_INTERVAL (default 30 seconds)
# bound the wait.
set -eu

tag=$1
version=${tag#api@}
if [ "$version" = "$tag" ] || [ -z "$version" ]; then
  printf 'Expected an api@x.y.z tag, got %s\n' "$tag" >&2
  exit 1
fi

attempts=${NPM_WAIT_ATTEMPTS:-20}
interval=${NPM_WAIT_INTERVAL:-30}
attempt=1
while :; do
  # A version npm doesn't serve yet prints nothing; a registry error is retried.
  if published=$(timeout 60 npm view "@sentry/api@$version" version 2>/dev/null) &&
    [ "$published" = "$version" ]; then
    printf '@sentry/api@%s is on npm.\n' "$version"
    exit 0
  fi
  if [ "$attempt" -ge "$attempts" ]; then
    printf '@sentry/api@%s is still not on npm after %s attempts.\n' "$version" "$attempts" >&2
    exit 1
  fi
  printf '@sentry/api@%s is not on npm yet (attempt %s/%s), retrying in %ss.\n' \
    "$version" "$attempt" "$attempts" "$interval"
  attempt=$((attempt + 1))
  sleep "$interval"
done
