#!/bin/bash
# Validates that .envrc works in a Git worktree with a per-worktree virtualenv.
# Creates a temporary worktree, runs devenv sync to create .venv, then runs direnv
# and checks sentry --version. Requires direnv and devenv on PATH.
set -eu

REPO_ROOT="$(
    cd "$(dirname "${BASH_SOURCE[0]}")/.."
    pwd -P
)"
WORKTREE="${REPO_ROOT}/../sentry-worktree-validate-$$"

cleanup() {
    if [ -d "$WORKTREE" ]; then
        git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" 2>/dev/null || true
        rm -rf "$WORKTREE"
    fi
}
trap cleanup EXIT

if ! command -v direnv >/dev/null 2>&1; then
    echo "ERROR: direnv is not on PATH. Install it and retry."
    exit 1
fi

if ! command -v devenv >/dev/null 2>&1; then
    echo "ERROR: devenv is not on PATH. Install it and retry."
    exit 1
fi

echo "Creating temporary worktree at $WORKTREE ..."
git -C "$REPO_ROOT" worktree add "$WORKTREE" HEAD

echo "Running devenv sync in worktree (SENTRY_DEVENV_SKIP_FRONTEND=1 for speed)..."
(cd "$WORKTREE" && SENTRY_DEVENV_SKIP_FRONTEND=1 devenv sync)

echo "Running direnv allow in worktree ..."
(cd "$WORKTREE" && direnv allow)

echo "Checking sentry in worktree with per-worktree venv ..."
if (cd "$WORKTREE" && "$WORKTREE/.venv/bin/sentry" --version) >/dev/null 2>&1; then
    echo "SUCCESS: Worktree env validation passed (sentry --version in worktree with per-worktree .venv)."
else
    echo "FAIL: sentry --version failed in worktree with per-worktree .venv."
    exit 1
fi
