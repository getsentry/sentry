#!/usr/bin/env bash

BASE_SHA=${VERCEL_GIT_PREVIOUS_SHA:-}
if [ -z "$BASE_SHA" ] || ! git cat-file -e "$BASE_SHA^{commit}" 2>/dev/null; then
  BASE_SHA=$(git rev-parse HEAD^ 2>/dev/null) || exit 1
fi

CHANGED=$(git diff --name-only "$BASE_SHA" HEAD 2>/dev/null) || exit 1

! printf '%s\n' "$CHANGED" | grep -qE '^(static/|build-utils/|src/sentry/locale/|src/sentry/static/sentry/images/|package\.json$|pnpm-lock\.yaml$|tsconfig\.json$|rspack\.config\.ts$|vercel\.json$|\.vercelignore$)'
