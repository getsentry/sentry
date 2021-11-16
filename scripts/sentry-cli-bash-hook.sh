#!/bin/bash
# This file is forked from https://github.com/getsentry/sentry-cli/blob/1ac54dfc9b1a03b4d976003996350c1a4f6eaabb/src/bashsupport.sh
_SENTRY_TRACEBACK_FILE="___SENTRY_TRACEBACK_FILE___"
_SENTRY_LOG_FILE="___SENTRY_LOG_FILE___"

if [ "${SENTRY_CLI_NO_EXIT_TRAP-0}" != 1 ]; then
  trap _sentry_exit_trap EXIT
fi
trap _sentry_err_trap ERR

_sentry_shown_traceback=0

_sentry_exit_trap() {
  local _exit_code="$?"
  local _command="${BASH_COMMAND:-unknown}"
  if [[ $_exit_code != 0 && "${_sentry_shown_traceback}" != 1 ]]; then
    _sentry_err_trap "$_command" "$_exit_code"
  fi
  rm -f "$_SENTRY_TRACEBACK_FILE" "$_SENTRY_LOG_FILE"
  exit $_exit_code
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
  export SENTRY_LAST_EVENT=$(___SENTRY_CLI___ bash-hook --send-event --traceback "$_SENTRY_TRACEBACK_FILE" --log "$_SENTRY_LOG_FILE" ___SENTRY_NO_ENVIRON___)
  rm -f "$_SENTRY_TRACEBACK_FILE" "$_SENTRY_LOG_FILE"
}

_sentry_traceback() {
  _sentry_shown_traceback=1
  local -i start=$(( ${1:-0} + 1 ))
  local -i end=${#BASH_SOURCE[@]}
  local -i i=0
  local -i j=0

  : > "$_SENTRY_TRACEBACK_FILE"
  for ((i=${start}; i < ${end}; i++)); do
    j=$(( $i - 1 ))
    local function="${FUNCNAME[$i]}"
    local file="${BASH_SOURCE[$i]}"
    local line="${BASH_LINENO[$j]}"
    echo "${function}:${file}:${line}" >> "$_SENTRY_TRACEBACK_FILE"
  done
}

: > "$_SENTRY_LOG_FILE"

if command -v perl >/dev/null; then
  exec \
    1> >(tee >(perl '-MPOSIX' -ne '$|++; print strftime("%Y-%m-%d %H:%M:%S %z: ", localtime()), "stdout: ", $_;' >> "$_SENTRY_LOG_FILE")) \
    2> >(tee >(perl '-MPOSIX' -ne '$|++; print strftime("%Y-%m-%d %H:%M:%S %z: ", localtime()), "stderr: ", $_;' >> "$_SENTRY_LOG_FILE") >&2)
else
  exec \
    1> >(tee >(awk '{ system(""); print strftime("%Y-%m-%d %H:%M:%S %z:"), "stdout:", $0; system(""); }' >> "$_SENTRY_LOG_FILE")) \
    2> >(tee >(awk '{ system(""); print strftime("%Y-%m-%d %H:%M:%S %z:"), "stderr:", $0; system(""); }' >> "$_SENTRY_LOG_FILE") >&2)
fi
