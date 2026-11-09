#!/bin/sh
# Decides whether openapi.yml releases @sentry/api from HEAD, a master commit
# whose spec files are in SPEC_DIR. To release, writes the version bump for
# craft to $GITHUB_OUTPUT as version=<bump>. To skip, writes nothing.
#
# The release-branch and tag checks follow getsentry/sentry-api-schema#137's
# release-preflight.sh, so a burst of merges releases once and nothing that
# lands while a release is pending is left unreleased.
#
# Environment:
#   SPEC_DIR       The package's spec/ files built from HEAD.
#   GITHUB_OUTPUT  Set by GitHub Actions.
set -eu

package_dir=static/packages/api
tag_prefix=api@

skip() {
  printf '::notice::%s\n' "$1"
  exit 0
}

if [ ! -f "$SPEC_DIR/openapi-derefed.json" ]; then
  printf '::error::%s has no openapi-derefed.json.\n' "$SPEC_DIR"
  exit 1
fi

# Automatic releases start after a person cuts the first one from here.
if ! base=$(git describe --tags --abbrev=0 --match "$tag_prefix*" 2>/dev/null); then
  skip "No $tag_prefix release yet. Cut the first one with the Release workflow."
fi

# Craft refuses to cut a release while one is pending. When that release
# merges into master, the run for the merge releases whatever landed meanwhile.
pending=$(git ls-remote --heads origin "refs/heads/${tag_prefix%@}/release/*")
if [ -n "$pending" ]; then
  skip "A release is still pending: $pending"
fi

# Craft takes the next version from the latest tag in HEAD's history. A newer
# tag outside it means HEAD predates that release, and the run for that
# release's merge covers this commit.
tags=$(git tag --list "$tag_prefix*" --sort=-version:refname)
newest=${tags%%[[:space:]]*}
if [ "$newest" != "$base" ]; then
  skip "HEAD predates release $newest."
fi

released=$(mktemp -d)
trap 'rm -rf "$released"' EXIT
trap 'exit 1' INT TERM
tarball=$(timeout 300 npm pack "@sentry/api@${base#"$tag_prefix"}" --pack-destination "$released" --silent)
tar -xzf "$released/$tarball" -C "$released"

spec_changed=false
data_changed=false
for file in "$SPEC_DIR"/*; do
  name=${file##*/}
  # cmp exits 1 when the files differ and 2 when the release lacks the file.
  if ! cmp -s "$file" "$released/package/spec/$name"; then
    if [ "$name" = openapi-derefed.json ]; then
      spec_changed=true
    else
      data_changed=true
    fi
  fi
done

if git diff --quiet "$base" HEAD -- "$package_dir"; then
  package_changed=false
else
  status=$?
  if [ "$status" -ne 1 ]; then
    exit "$status"
  fi
  package_changed=true
fi

# Spec updates are minor releases, as they were in sentry-api-schema. Package
# changes take craft's bump from their commits. Ownership or RPC schema
# changes alone are patches.
if [ "$spec_changed" = true ]; then
  bump='minor'
elif [ "$package_changed" = true ]; then
  bump='auto'
elif [ "$data_changed" = true ]; then
  bump='patch'
else
  skip "Nothing changed since $base."
fi
printf '::notice::Releasing a %s bump on %s.\n' "$bump" "$base"
printf 'version=%s\n' "$bump" >>"$GITHUB_OUTPUT"
