#!/usr/bin/env bash
# Runs a command and samples its pytest processes (controller and xdist workers)
# with py-spy. Writes collapsed stacks, one root frame per process, to
# $PY_SPY_OUTPUT. Exits with the command's status, not py-spy's.
#
#   PY_SPY=/path/to/py-spy PY_SPY_OUTPUT=.artifacts/py-spy.txt \
#     profile-backend-tests.sh make test-python-ci
set -u

descends_from() {
  local pid=$1 ancestor=$2
  while [ "$pid" -gt 1 ]; do
    [ "$pid" -eq "$ancestor" ] && return 0
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ') || return 1
    [ -n "$pid" ] || return 1
  done
  return 1
}

"$@" &
cmd_pid=$!

# py-spy attaches to the controller and follows the workers it spawns.
pytest_pid=""
for _ in $(seq 1 240); do
  for pid in $(pgrep -f 'pytest-selected\.py' || true); do
    if descends_from "$pid" "$cmd_pid"; then
      pytest_pid=$pid
      break
    fi
  done
  [ -n "$pytest_pid" ] && break
  kill -0 "$cmd_pid" 2>/dev/null || break
  sleep 0.5
done

spy_pid=""
if [ -n "$pytest_pid" ]; then
  "$PY_SPY" record --pid "$pytest_pid" --subprocesses --nonblocking --full-filenames \
    --rate "${PY_SPY_RATE:-20}" --format raw --output "$PY_SPY_OUTPUT" \
    >"${RUNNER_TEMP:-/tmp}/py-spy.log" 2>&1 &
  spy_pid=$!
else
  echo "::warning::py-spy: pytest-selected.py never started; not profiling"
fi

rc=0
wait "$cmd_pid" || rc=$?
if [ -n "$spy_pid" ]; then
  # py-spy stops and writes its output once the controller exits.
  wait "$spy_pid" || echo "::warning::py-spy exited non-zero; see py-spy.log"
  tail -5 "${RUNNER_TEMP:-/tmp}/py-spy.log"
fi
exit "$rc"
