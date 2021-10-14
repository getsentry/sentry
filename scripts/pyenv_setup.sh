#!/bin/bash
# This script correctly sets up pyenv
#
# Assumptions:
# - This script assumes you're calling from the top directory of the repository
#
# shellcheck disable=SC2155 # Declare and assign separately to avoid masking return values.

set -eu

HERE="$(
  cd "$(dirname "${BASH_SOURCE[0]}")"
  pwd -P
)"
source "${HERE}/lib.sh"

# We can use PYENV_VERSION to define different Python versions, otherwise, determine load default values
[ -z ${PYENV_VERSION+x} ] && export PYENV_VERSION=$(get-pyenv-version)

get_shell_startup_script() {
  local _startup_script=''
  if [[ -n "$SHELL" ]]; then
    case "$SHELL" in
    */bash)
      _startup_script="${HOME}/.bash_profile"
      ;;
    */zsh)
      _startup_script="${HOME}/.zprofile"
      ;;
    */fish)
      _startup_script="${HOME}/.config/fish/config.fish"
      ;;
    *)
      echo "$SHELL is currently not supported."
      exit 1
      ;;
    esac
  else
    echo "The environment variable \$SHELL needs to be defined."
    exit 1
  fi
  echo "$_startup_script"
}

# The first \n is important on Github workers since it was being appended to
# the last line rather than on a new line. I never figured out why
_append_to_startup_script() {
  if [[ -n "$SHELL" ]]; then
    case "$SHELL" in
    */bash)
      # shellcheck disable=SC2016
      echo "Visit https://github.com/pyenv/pyenv#installation on how to fully set up your Bash shell."
      ;;
    */zsh)
      # shellcheck disable=SC2016
      echo -e '# It is assumed that pyenv is installed via Brew, so this is all we need to do.\n' \
        'eval "$(pyenv init --path)"' >>"${1}"
      ;;
    */fish)
      # shellcheck disable=SC2016
      echo -e '\n# pyenv init\nstatus is-login; and pyenv init --path | source' >>"${1}"
      ;;
    esac

    echo "--> Tail of ${1}"
    tail -n 3 "${1}"
  fi
}

append_to_config() {
  if [[ -n "$1" ]]; then
    if grep -qF "(pyenv init -)" "${1}"; then
      echo >&2 "!!! Please remove the old-style pyenv initialization and try again:"
      echo "sed -i.bak 's/(pyenv init -)/(pyenv init --path)/' ${1}"
      exit 1
    fi
    if ! grep -qF "pyenv init --path" "${1}"; then
      echo "Adding pyenv init --path to ${1}..."
      # pyenv init --path is needed to include the pyenv shims in your PATH
      _append_to_startup_script "${1}"
    fi
  fi
}

install_pyenv() {
  if require pyenv; then
    # NOTE: We're dropping support for older pyenv versions
    if [[ "$(pyenv -v | awk '{print $2}')" < 2.0.0 ]]; then
      echo >&2 "!!! We've dropped support for pyenv v1." \
        "Run the following (this is slow) and try again."
      # brew upgrade does not quite do the right thing
      # > ~/.pyenv/shims/python: line 8: /usr/local/Cellar/pyenv/1.2.26/libexec/pyenv: No such file or directory
      echo >&2 "brew update && brew uninstall pyenv && brew install pyenv"
      exit 1
    fi
    # Only try to patch the source code if:
    # - The user is on Big Sur
    # - The user is not try to use their own Python version
    # - The version is 3.6.x
    if query-big-sur && [[ -z "${SENTRY_PYTHON_VERSION:-}" ]] && [[ ${PYENV_VERSION} < 3.7.0 ]]; then
      # For Python 3.6.x, we need to patch the source code on Big Sur before building Python
      # We can remove this once we upgrade to newer versions of Python
      # cat is used since pyenv would finish to soon when the Python version is already installed
      curl -sSL https://github.com/python/cpython/commit/8ea6353.patch | cat |
        pyenv install --skip-existing --patch "${PYENV_VERSION}"
    else
      pyenv install --skip-existing "${PYENV_VERSION}"
    fi
  else
    echo >&2 "!!! pyenv not found, try running bootstrap script again or run \`brew bundle\` in the sentry repo"
    exit 1
  fi
}

# Setup pyenv of path
setup_pyenv() {
  configure-sentry-cli
  install_pyenv
  append_to_config "$(get_shell_startup_script)"

  # If the script is called with the "dot space right" approach (. ./scripts/pyenv_setup.sh),
  # the effects of this will be persistent outside of this script
  # Sets up PATH for pyenv
  eval "$(pyenv init --path)"
  python_version=$(python -V | sed s/Python\ //g)
  [[ $python_version == "${PYENV_VERSION}" ]] ||
    (echo "Wrong Python version: $python_version. Please report in #discuss-dev-tooling" && exit 1)
}

setup_pyenv
