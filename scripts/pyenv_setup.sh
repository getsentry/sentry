#!/bin/bash
# This script correctly sets up pyenv
#
# Assumptions:
# - This script assumes you're calling from the top directory of the repository
set -eu

# Check if a command is available
require() {
    command -v "$1" >/dev/null 2>&1
}

query_big_sur() {
    if require sw_vers && sw_vers -productVersion | grep -E "11\." > /dev/null; then
        return 0
    fi
    return 1
}

get_shell_startup_script() {
  _startup_script=''
  if [ -n "$SHELL" ]; then
    case "$SHELL" in
      */bash)
        _startup_script="${HOME}/.bash_profile"
        ;;
      */zsh)
        _startup_script="${HOME}/.zshrc"
        ;;
      */fish)
        _startup_script="${HOME}/.config/fish/config.fish"
        ;;
      *)
        echo "$SHELL is currently not supported."
        exit 1
    esac
  else
    echo "The environment variable \$SHELL needs to be defined."
    exit 1
  fi
}

_append_to_startup_script() {
  if [ -n "$SHELL" ]; then
    case "$SHELL" in
      */bash)
        # shellcheck disable=SC2016
        echo -e '\nif command -v pyenv 1>/dev/null 2>&1; then\n  eval "$(pyenv init -)"\nfi' >> "${1}"
        ;;
      */zsh)
        # shellcheck disable=SC2016
        echo -e '\nif command -v pyenv 1>/dev/null 2>&1; then\n  eval "$(pyenv init -)"\nfi' >> "${1}"
        ;;
      */fish)
        echo -e '\n\n# pyenv init\nif command -v pyenv 1>/dev/null 2>&1\n  pyenv init - | source\nend' >> "$1"
    esac

    echo "  --> Tail of ${1}"
    tail -n 3 "${1}"
  fi
}

append_to_config() {
  get_shell_startup_script
  if [ -n "$_startup_script" ]; then
    echo "Adding pyenv init (if missing) to ${_startup_script}..."
    # shellcheck disable=SC2016
    if ! grep -qF 'eval "$(pyenv init -)"' "${_startup_script}"; then
      # pyenv init - is needed to include the pyenv shims in your PATH
      # The first \n is very important since on Github workers the output was being appended to
      # the last line rather than on a new line. I never figured out why
      _append_to_startup_script "${_startup_script}"
    fi
  fi
}

# Setup pyenv of path
setup_pyenv() {
  if command -v pyenv &>/dev/null; then
    echo "Installing Python (if missing) via pyenv"
    local pyenv_version
    pyenv_version=$(pyenv -v | awk '{print $2}')
    python_version=$(xargs -n1 < .python-version)

    if query_big_sur; then
      local flag
      # NOTE: pyenv 1.2.22 or greater does not require using LDFLAGS
      # https://github.com/pyenv/pyenv/pull/1711
      if [[ "$pyenv_version" < 1.2.22 ]]; then
        flag="-L$(xcrun --show-sdk-path)/usr/lib ${LDFLAGS}"
      fi
      # cat is used since pyenv would finish to soon when the Python version is already installed
      curl -sSL https://github.com/python/cpython/commit/8ea6353.patch | cat | \
        LDFLAGS="$flag" pyenv install --skip-existing --patch "$python_version"
    else
      pyenv install --skip-existing "$python_version"
    fi
  else
    echo "!!! pyenv not found, try running bootstrap script again or run \`brew bundle\` in the sentry repo"
    exit 1
  fi

  append_to_config

  # If the script is called with the "dot space right" approach (. ./scripts/pyenv_setup.sh),
  # the effects of this will be persistent outside of this script
  # shellcheck disable=SC1090
  source "${_startup_script}"
  # The Python version installed via pyenv does not come with wheel pre-installed
  # Installing wheel will speed up installation of Python dependencies
  PIP_DISABLE_PIP_VERSION_CHECK=on pip install wheel
}

setup_pyenv
