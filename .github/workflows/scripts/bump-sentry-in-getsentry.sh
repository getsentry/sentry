#!/bin/sh
# Bumps getsentry's sentry version to GITHUB_SHA with bin.bump_sentry, and
# pushes it to getsentry's master. Run from the directory that holds the
# sentry and getsentry checkouts.
set -eux

: "${GITHUB_SHA:?}"

cd getsentry

python -S -m bin.bump_sentry "$GITHUB_SHA"

# If getsentry is pushed to by any other means while we were here,
# we won't be able to push.
for _ in 1 2 3 4 5; do
  git push origin master && exit 0
  # There's a little bit of network delay here that suffices
  # as a small sleep.
  git \
    -c user.name=getsentry-bot \
    -c user.email=bot@sentry.io \
    pull --rebase origin master
done

# 5th and final attempt.
git push origin master
