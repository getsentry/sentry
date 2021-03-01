#!/bin/bash
# This code is mostly the output of calling `sentry-cli bash-hook`
# This is used by direnv's execution path since the default behaviour of
# `sentry-cli bash hook` does not work with it. For instance,
# 1) We should not trap EXIT for direnv needs that untrapped
# 2) There's a bug on SENTRY_LOG_FILE that is not fully written to disk before reporting
set -e

_SENTRY_TRACEBACK_FILE=$(mktemp -t sentry-direnv-envrc.traceback)
_SENTRY_LOG_FILE=$(mktemp -t sentry-direnv-envrc.out)

# Wait for file to be written to disk
_wait_for_file() {
  local filesize
  for i in {0..10}
  do
    filesize=$(du -k "$1" | cut -f1)
    if [[ $filesize -gt 0 ]]; then
      break
    else
      sleep 0.1
    fi
  done
}

_sentry_err_trap() {
  local _exit_code="$?"
  local _command="${BASH_COMMAND:-unknown}"
  if [ "x$1" != x ]; then
    _command="$1"
  fi
  if [ "x$2" != x ]; then
    _exit_code="$2"
  fi
  _sentry_traceback 1
  echo "@command:${_command}" >> "$_SENTRY_TRACEBACK_FILE"
  echo "@exit_code:${_exit_code}" >> "$_SENTRY_TRACEBACK_FILE"

  : >> "$_SENTRY_LOG_FILE"
  # This line is differing from upstream _sentry_err_trap
  _wait_for_file "$_SENTRY_LOG_FILE"

  # The specified DSN reports to `sentry-dev-env` project in Sentry.io
  # shellcheck disable=SC2155
  export SENTRY_LAST_EVENT=$(
    SENTRY_DSN=https://23670f54c6254bfd9b7de106637808e9@o1.ingest.sentry.io/1492057 \
    /usr/local/bin/sentry-cli bash-hook --send-event \
    --traceback "$_SENTRY_TRACEBACK_FILE" --log "$_SENTRY_LOG_FILE" )
  rm -f "$_SENTRY_TRACEBACK_FILE" "$_SENTRY_LOG_FILE"
}

_sentry_traceback() {
  local -i start=$(( ${1:-0} + 1 ))
  local -i end=${#BASH_SOURCE[@]}
  local -i i=0
  local -i j=0

  : > "$_SENTRY_TRACEBACK_FILE"
  # shellcheck disable=SC2004
  for ((i=${start}; i < ${end}; i++)); do
    j=$(( $i - 1 ))
    local function="${FUNCNAME[$i]}"
    local file="${BASH_SOURCE[$i]}"
    local line="${BASH_LINENO[$j]}"
    echo "${function}:${file}:${line}" >> "$_SENTRY_TRACEBACK_FILE"
  done
}

# Same effect as cat /dev/null > "$_SENTRY_LOG_FILE"
# However, this does not fork a new process, since ":" is a builtin.
: > "$_SENTRY_LOG_FILE"

if command -v perl >/dev/null; then
  # XXX: Breadcumbs don't correctly show the order of the lines. Peharps, it's due to lacking milliseconds
  exec \
    1> >(tee >(perl '-MPOSIX' -ne '$|++; print strftime("%Y-%m-%d %H:%M:%S %z: ", localtime()), "stdout: ", $_;' >> "$_SENTRY_LOG_FILE")) \
    2> >(tee >(perl '-MPOSIX' -ne '$|++; print strftime("%Y-%m-%d %H:%M:%S %z: ", localtime()), "stderr: ", $_;' >> "$_SENTRY_LOG_FILE") >&2)
else
  exec \
    1> >(tee >(awk '{ system(""); print strftime("%Y-%m-%d %H:%M:%S %z:"), "stdout:", $0; system(""); }' >> "$_SENTRY_LOG_FILE")) \
    2> >(tee >(awk '{ system(""); print strftime("%Y-%m-%d %H:%M:%S %z:"), "stderr:", $0; system(""); }' >> "$_SENTRY_LOG_FILE") >&2)
fi
