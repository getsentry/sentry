#!/usr/bin/env bash
# Runs `devservices up` for CI, optionally in the background so image pulls and
# container health checks overlap the Python environment setup.
#
#   devservices-bg.sh start  Install the devservices version pinned in
#                            $DEVSERVICES_LOCKFILE into a throwaway venv using
#                            the system python, then start `devservices up` in
#                            the background. Fails without side effects if it
#                            can't (callers should treat that as non-fatal).
#   devservices-bg.sh wait   Wait for a background `devservices up`, print its
#                            log and exit with its status. If `start` didn't
#                            run or didn't succeed, run `devservices up` in the
#                            foreground with whatever devservices is on PATH.
#
# Either way the exit status of `devservices up` is written to
# $RUNNER_TEMP/devservices-ci/up.exit, which bootstrap-snuba.py watches via
# DEVSERVICES_STATUS_FILE.
#
# Environment: DEVSERVICES_MODE, DEVSERVICES_TIMEOUT (minutes, default 10),
# DEVSERVICES_WORKDIR (default .), DEVSERVICES_LOCKFILE (start only).
#
# Kept in sync with getsentry's .github/actions/start-devservices/devservices-bg.sh.
set -euo pipefail

STATE_DIR="${RUNNER_TEMP:?}/devservices-ci"
WORKDIR="${DEVSERVICES_WORKDIR:-.}"
TIMEOUT_MINUTES="${DEVSERVICES_TIMEOUT:-10}"
MODE="${DEVSERVICES_MODE:?}"

# Prevent git from spawning background gc/maintenance processes during
# dependency clones, which races with shutil.copytree (git 2.54 regression).
git_config_set() {
  git config --global gc.auto 0
  git config --global maintenance.auto 0
  git config --global fetch.writeCommitGraph false
}

git_config_unset() {
  git config --global --unset gc.auto || true
  git config --global --unset maintenance.auto || true
  git config --global --unset fetch.writeCommitGraph || true
}

write_status() {
  echo "$1" >"$STATE_DIR/up.exit.tmp"
  mv "$STATE_DIR/up.exit.tmp" "$STATE_DIR/up.exit"
}

start() {
  rm -rf "$STATE_DIR"
  mkdir -p "$STATE_DIR"

  local lockfile="${DEVSERVICES_LOCKFILE:?}"
  local version index
  # tomllib needs python >= 3.11; the runner's system python3 is 3.12.
  read -r version index < <(
    python3 - "$lockfile" <<'PY'
import sys
import tomllib

with open(sys.argv[1], "rb") as f:
    lock = tomllib.load(f)
pkgs = [p for p in lock["package"] if p["name"] == "devservices"]
if len(pkgs) != 1:
    sys.exit(f"expected one devservices package in {sys.argv[1]}, found {len(pkgs)}")
print(pkgs[0]["version"], pkgs[0].get("source", {}).get("registry", "https://pypi.org/simple"))
PY
  )
  echo "Installing devservices==$version from $index"

  # Run uv from the state dir so it doesn't pick up the repo's pyproject.toml
  # (and its requires-python) as a project.
  (
    cd "$STATE_DIR"
    UV_PYTHON_DOWNLOADS=never uv venv --quiet --python python3 venv
    uv pip install --quiet --python venv/bin/python --index-url "$index" "devservices==$version"
  )

  git_config_set
  (
    cd "$WORKDIR"
    # setsid + nohup: keep running after this step's shell exits.
    # shellcheck disable=SC2016 # expanded by the inner bash
    setsid nohup bash -c '
      timeout "$1m" "$2/venv/bin/devservices" up --mode "$3"
      rc=$?
      echo "$rc" > "$2/up.exit.tmp" && mv "$2/up.exit.tmp" "$2/up.exit"
    ' _ "$TIMEOUT_MINUTES" "$STATE_DIR" "$MODE" </dev/null >"$STATE_DIR/up.log" 2>&1 &
    echo $! >"$STATE_DIR/pid"
  )
  touch "$STATE_DIR/started"
  echo "Started devservices up --mode $MODE in the background (log: $STATE_DIR/up.log)"
}

run_foreground() {
  mkdir -p "$STATE_DIR"
  git_config_set
  local rc=0
  (cd "$WORKDIR" && timeout "${TIMEOUT_MINUTES}m" devservices up --mode "$MODE") || rc=$?
  write_status "$rc"
  git_config_unset
  return "$rc"
}

wait_background() {
  if [ ! -f "$STATE_DIR/started" ]; then
    run_foreground
    return
  fi

  # devservices up is already bounded by `timeout`; this is a backstop.
  local deadline=$((SECONDS + TIMEOUT_MINUTES * 60 + 60))
  local next_status=$((SECONDS + 30))
  until [ -f "$STATE_DIR/up.exit" ]; do
    if ((SECONDS > deadline)); then
      cat "$STATE_DIR/up.log" || true
      echo "::error::Timed out waiting for background devservices up"
      kill -- "-$(cat "$STATE_DIR/pid")" 2>/dev/null || true
      write_status 124
      git_config_unset
      return 124
    fi
    if ((SECONDS >= next_status)); then
      echo "still waiting for background devservices up..."
      next_status=$((SECONDS + 30))
    fi
    sleep 1
  done

  cat "$STATE_DIR/up.log"
  git_config_unset
  local rc
  rc="$(cat "$STATE_DIR/up.exit")"
  if [ "$rc" != 0 ]; then
    echo "::error::devservices up failed (exit $rc)"
    return "$rc"
  fi
}

case "${1:-}" in
  start) start ;;
  wait) wait_background ;;
  *)
    echo "usage: $0 start|wait" >&2
    exit 2
    ;;
esac
