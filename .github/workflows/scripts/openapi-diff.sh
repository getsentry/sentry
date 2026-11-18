#!/bin/sh
# Compare a pull request's API schemas with the ones on master where it
# branched off. Used by .github/workflows/openapi-diff.yml and
# `make diff-api-docs`.
#
#   openapi-diff.sh baseline DIR
#       Write the merge-base's openapi-derefed.json and rpc_method_schema.json
#       to DIR, and a one-line description of where they came from to
#       DIR/source.txt. Tries, in order:
#         1. the `api-schemas` artifact of the openapi workflow run for the
#            merge-base, or for the closest earlier master commit that has one;
#         2. the newest `api@` GitHub release.
#       With BASE_SHA and HEAD_SHA set (CI), the merge-base comes from the
#       GitHub API. Otherwise it is `git merge-base origin/master HEAD`.
#   openapi-diff.sh changelog BASE_SPEC PR_SPEC
#       Write an oasdiff changelog as Markdown to $GITHUB_STEP_SUMMARY, or to
#       stdout when that is unset. Never fails the build: a missing baseline
#       or an oasdiff error becomes a note in the summary.
#   openapi-diff.sh rpc-breaking BASE_SCHEMA PR_SCHEMA
#       Fail on RPC method schema changes that break callers.
#   openapi-diff.sh label-api-changelog BASE_DIR PR_SPEC PR_SCHEMA
#       Give pull request PR_NUMBER the `changelog: @sentry/api` label when
#       PR_SPEC or PR_SCHEMA differs from its copy in BASE_DIR, and take it
#       away when neither does. Craft puts labelled pull requests in the
#       @sentry/api changelog, which otherwise only sees commits to
#       static/packages/api (see .craft.yml).
#   openapi-diff.sh unlabel-api-changelog
#       Take that label away from pull request PR_NUMBER, for a pull request
#       that no longer touches the files the schemas are built from.
#
# Environment: GH_TOKEN (or a logged-in gh), GITHUB_REPOSITORY (defaults to
# getsentry/sentry), BASE_SHA and HEAD_SHA (optional). The label commands also
# need PR_NUMBER, and HEAD_REPO, the repository the pull request comes from.
set -eu

repo=${GITHUB_REPOSITORY:-getsentry/sentry}
artifact=api-schemas
oasdiff_image=ghcr.io/getsentry/image-mirror-tufin-oasdiff:v1.33.0
# How many master commits before the merge-base to search for an artifact.
# Every commit that can change the schemas uploads one.
max_commits=30
# GitHub rejects step summaries over 1 MiB.
max_summary_bytes=900000
# Craft's `changelog: {{packageName}}` in .craft.yml. A maintainer creates the
# label; gh refuses to add one that does not exist.
api_changelog_label='changelog: @sentry/api'

merge_base() {
  if [ -n "${BASE_SHA:-}" ] && [ -n "${HEAD_SHA:-}" ]; then
    timeout 60 gh api "repos/$repo/compare/$BASE_SHA...$HEAD_SHA" --jq .merge_base_commit.sha
  else
    git merge-base origin/master HEAD
  fi
}

# Print the id of the `api-schemas` artifact uploaded for a master commit, or
# nothing when that commit's openapi run did not upload one.
artifact_for_commit() {
  run_ids=$(timeout 60 gh api \
    "repos/$repo/actions/workflows/openapi.yml/runs?head_sha=$1&event=push&status=success" \
    --jq '.workflow_runs[].id') || return 1
  for run_id in $run_ids; do
    artifact_id=$(timeout 60 gh api "repos/$repo/actions/runs/$run_id/artifacts?name=$artifact" \
      --jq '[.artifacts[] | select(.expired | not)][0].id // empty') || return 1
    if [ -n "$artifact_id" ]; then
      printf '%s\n' "$artifact_id"
      return 0
    fi
  done
}

from_artifact() {
  dest=$1
  mb=$(merge_base) || return 1
  commits=$(timeout 60 gh api "repos/$repo/commits?sha=$mb&per_page=$max_commits" --jq '.[].sha') || return 1
  for sha in $commits; do
    artifact_id=$(artifact_for_commit "$sha") || return 1
    if [ -n "$artifact_id" ]; then
      zip="$dest/$artifact.zip"
      timeout 300 gh api "repos/$repo/actions/artifacts/$artifact_id/zip" > "$zip" || return 1
      unzip -o -q "$zip" -d "$dest/artifact" || return 1
      # The files keep their repository paths, which differ between versions
      # of the openapi workflow, so look them up by name.
      for name in openapi-derefed.json rpc_method_schema.json; do
        file=$(find "$dest/artifact" -type f -name "$name") || return 1
        if [ -z "$file" ]; then
          echo "The $artifact artifact for $sha has no $name." >&2
          return 1
        fi
        mv "$file" "$dest/$name" || return 1
      done
      rm -r "$zip" "$dest/artifact"
      printf 'the openapi workflow artifact for %s (merge-base %s)\n' "$sha" "$mb" > "$dest/source.txt"
      return 0
    fi
  done
  echo "No $artifact artifact for the $max_commits master commits up to the merge-base $mb." >&2
  return 1
}

from_release() {
  dest=$1
  tag=$(timeout 60 gh api "repos/$repo/releases?per_page=100" \
    --jq '[.[] | select(.tag_name | startswith("api@"))][0].tag_name // empty') || return 1
  if [ -z "$tag" ]; then
    echo "No api@ release yet." >&2
    return 1
  fi
  timeout 300 gh release download "$tag" --repo "$repo" --dir "$dest" --clobber \
    --pattern openapi-derefed.json --pattern rpc_method_schema.json || return 1
  printf 'the %s release, which can be newer than the merge-base\n' "$tag" > "$dest/source.txt"
}

baseline() {
  out=$1
  # Each source starts from an empty directory, so a source that fails
  # halfway leaves nothing behind for the next one.
  work="$out.partial"
  for source in from_artifact from_release; do
    rm -rf "$work"
    mkdir -p "$work"
    if "$source" "$work"; then
      rm -rf "$out"
      mv "$work" "$out"
      description=$(cat "$out/source.txt")
      echo "Baseline: $description"
      return 0
    fi
    echo "$source found no baseline, trying the next source." >&2
  done
  rm -rf "$work"
  echo "::error::Found no baseline API schemas."
  return 1
}

oasdiff() {
  docker run --rm -v "$PWD:$PWD" -w "$PWD" "$oasdiff_image" "$@"
}

changelog() {
  summary=${GITHUB_STEP_SUMMARY:-/dev/stdout}
  description=$(cat "$(dirname "$1")/source.txt" 2>/dev/null) || description='an unknown baseline'
  {
    echo '## Public API changes'
    echo
    if [ ! -f "$1" ]; then
      echo 'There is no baseline spec to compare with; see the build job log.'
    elif ! report=$(oasdiff changelog "$1" "$2" --format markdown); then
      echo 'oasdiff could not compare the specs; see this job log.'
    else
      echo "Compared with $description."
      echo
      if [ "${#report}" -gt "$max_summary_bytes" ]; then
        printf '%s\n' "$report" | head -c "$max_summary_bytes"
        echo
        echo "The changelog is cut off here; run \`make diff-api-docs\` for the rest."
      else
        printf '%s\n' "$report"
      fi
    fi
  } >> "$summary"
}

rpc_breaking() {
  oasdiff breaking "$1" "$2" --fail-on WARN --format githubactions
}

# Add the label when $1 is true and remove it otherwise.
set_api_changelog_label() {
  want=$1
  pr=${PR_NUMBER:?}
  # Pull requests from forks get a read-only token.
  if [ "${HEAD_REPO:?}" != "$repo" ]; then
    printf '::notice::Cannot label a pull request from %s. A maintainer sets "%s" by hand.\n' \
      "$HEAD_REPO" "$api_changelog_label"
    return 0
  fi
  labels=$(timeout 60 gh pr view "$pr" --repo "$repo" --json labels --jq '.labels[].name')
  # grep exits 1 for no match and 2 for an error.
  if printf '%s\n' "$labels" | grep -Fqx -e "$api_changelog_label"; then
    has=true
  else
    status=$?
    if [ "$status" -ne 1 ]; then
      return "$status"
    fi
    has=false
  fi
  if [ "$want" = "$has" ]; then
    echo "The label \"$api_changelog_label\" is already right ($has)."
  elif [ "$want" = true ]; then
    timeout 60 gh pr edit "$pr" --repo "$repo" --add-label "$api_changelog_label"
  else
    timeout 60 gh pr edit "$pr" --repo "$repo" --remove-label "$api_changelog_label"
  fi
}

# Print true when two schema files differ and false when they match.
schema_changed() {
  # cmp exits 1 when the files differ and 2 when one is missing.
  if cmp -s "$1" "$2"; then
    echo false
  else
    status=$?
    if [ "$status" -ne 1 ]; then
      printf '::error::Could not compare %s with %s.\n' "$2" "$1" >&2
      return "$status"
    fi
    echo true
  fi
}

# The same comparison api-package-release-preflight.sh makes against the last
# release, so the label marks the pull requests that change the next release.
label_api_changelog() {
  spec_changed=$(schema_changed "$1/openapi-derefed.json" "$2")
  rpc_changed=$(schema_changed "$1/rpc_method_schema.json" "$3")
  echo "Public spec changed: $spec_changed. RPC schema changed: $rpc_changed."
  if [ "$spec_changed" = true ] || [ "$rpc_changed" = true ]; then
    set_api_changelog_label true
  else
    set_api_changelog_label false
  fi
}

command=${1:-}
case $command in
  baseline) baseline "$2" ;;
  changelog) changelog "$2" "$3" ;;
  rpc-breaking) rpc_breaking "$2" "$3" ;;
  label-api-changelog) label_api_changelog "$2" "$3" "$4" ;;
  unlabel-api-changelog) set_api_changelog_label false ;;
  *)
    echo "usage: $0 baseline DIR | changelog BASE_SPEC PR_SPEC | rpc-breaking BASE_SCHEMA PR_SCHEMA" \
      "| label-api-changelog BASE_DIR PR_SPEC PR_SCHEMA | unlabel-api-changelog" >&2
    exit 2
    ;;
esac
