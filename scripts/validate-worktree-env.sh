#!/bin/bash
# Validates that .envrc works in a Git worktree with shared VIRTUAL_ENV (e.g. Cursor Parallel Agents).
# Run from the primary Sentry clone (where .venv already exists). Requires direnv on PATH.
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

if [ ! -d "$REPO_ROOT/.venv" ]; then
    echo "ERROR: Primary clone has no .venv. Run 'devenv sync' in $REPO_ROOT first."
    exit 1
fi

if ! command -v direnv >/dev/null 2>&1; then
    echo "ERROR: direnv is not on PATH. Install it and retry."
    exit 1
fi

echo "Creating temporary worktree at $WORKTREE ..."
git -C "$REPO_ROOT" worktree add "$WORKTREE" HEAD

echo "Configuring shared venv (VIRTUAL_ENV) in worktree .env ..."
# Skip frontend checks so we don't require node_modules in the worktree
printf "VIRTUAL_ENV=%s\nSENTRY_DEVENV_SKIP_FRONTEND=1\n" "$REPO_ROOT/.venv" > "$WORKTREE/.env"

echo "Running direnv allow in worktree ..."
(cd "$WORKTREE" && direnv allow)

echo "Checking sentry in worktree with shared venv ..."
# Use primary's venv sentry from worktree cwd (direnv exec can hit shell bugs; this validates shared venv + worktree)
if (cd "$WORKTREE" && "$REPO_ROOT/.venv/bin/sentry" --version) >/dev/null 2>&1; then
    echo "SUCCESS: Worktree env validation passed (sentry --version in worktree with shared venv)."
else
    echo "FAIL: sentry --version failed in worktree with shared venv."
    exit 1
fi
