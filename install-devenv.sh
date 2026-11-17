#!/bin/bash
# Manual test:
#   export DEBUG=1
#   export SNTY_DEVENV_REPO=file://$PWD
#   export SNTY_DEVENV_BRANCH="$(git branch --show-current)"
#   ./install-devenv.sh

# shellcheck disable=SC2016  # I know that single-quotes are hardquotes
# remembered so we can find a uv the user already installed (e.g. via brew)
ORIG_PATH="${PATH:-}"
export PATH=/usr/bin:/bin:/usr/sbin:/sbin
ME="$(basename "$0")"

## functions
# let users see important commands
show() {(set -x; "$@")}
# check if a command exists
has() { command -v "$@" >/dev/null; }
# tell the user something
info() { colorize "$ansi_teal" "$@"; }
# warn the user
warn() { colorize "$ansi_yellow" "$@"; }
error() { colorize "$ansi_red" "$@"; exit 1; }
yesno() { # ask a question
  prompt="$1$ansi_green [y/n]$ansi_reset: "
  while :; do
    info -n "$prompt"
    if [[ "${CI:-}" ]]; then
      REPLY="yes"
      info "$REPLY"
    else
      read -r
    fi

    case $REPLY in
        [yY]*) return 0 ;;
        [nN]*) return 1 ;;
        *) warn "Unrecognized response.";;
    esac
  done
}
# show a colorized message
colorize() {
  color="$1"
  shift 1
  {
    builtin echo -n "$color"
    builtin echo -e "$@"
    builtin echo -n "$ansi_reset"
  } >&2
}
http-get() {(
  # print the content of a (https) URL to stdout
  url="$1"
  if has curl; then
    curl -q -sSLf "$url"
  elif has wget; then
    wget -nv -O- "$url"
  else
    error 'Please install curl or wget and try again'
  fi
)}

constants() {
  # a few color codes
  ansi_yellow=$'\x1b[33m'
  ansi_red=$'\x1b[31m'
  ansi_green=$'\x1b[1;34m'
  ansi_teal=$'\x1b[36m'
  ansi_reset=$'\x1b[m'
  # fancy "prompt" for xtrace log
  export PS4="+ $ansi_green\$$ansi_reset "

  if [[ "${DEBUG:-}" || "${SNTY_DEVENV_DEBUG:-}" ]]; then
    set -x
    colorize() { :; }  # show messages just once
  fi

  # default values for system environment variables
  USER=$(id -un)
  HOME=$(eval 'echo ~')
  XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
  XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
  XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
  OSTYPE="$(uname -s | tr -d '0-9.' | tr '[:upper:]' '[:lower:]')"
  CPUTYPE="${CPUTYPE:-$(uname -m)}"
}

parseopt() {  # argument (and environment-var) processing
  appname="sentry-devenv"

  # used to control install behavior for CI
  SNTY_DEVENV_REPO="${SNTY_DEVENV_REPO:-https://github.com/getsentry/devenv.git}"
  SNTY_DEVENV_BRANCH="${1:-${SNTY_DEVENV_BRANCH:-main}}"

  SNTY_DEVENV_HOME="${SNTY_DEVENV_HOME:-$XDG_DATA_HOME/$appname}"
  SNTY_DEVENV_CACHE="${SNTY_DEVENV_CACHE:-$XDG_CACHE_HOME/$appname}"
  SNTY_DEVENV_PY_RELEASE="${SNTY_DEVENV_PY_RELEASE:-20230726}"
  SNTY_DEVENV_PY_VERSION="${SNTY_DEVENV_PY_VERSION:-3.11.4}"
}

# translate from uname output to astral release tags:
# e.g. https://github.com/astral-sh/python-build-standalone/releases
astral_os() {
  case "$OSTYPE" in
    darwin) echo apple-darwin ;;
    linux|linux-gnu) echo unknown-linux-gnu ;;
    *) echo '??' ;;
  esac
}
astral_cpu() {
  case "$CPUTYPE" in
    aarch64|arm64)
      echo aarch64 ;;
    x86_64)
      echo "$CPUTYPE" ;;
    *)
      echo '??' ;;
  esac
}

_check_checksum() {
  if has shasum; then  # macos
    shasum -a 256 --check --status
  elif has sha256sum; then  # linux
    sha256sum --check --status
  fi
}

check_checksum() {
  sha256="$1"
  path="$2"
  if [[ -f "$path" ]]; then
    echo "${sha256}  $path" | _check_checksum
  else
    return 1
  fi
}

install_python() {
  release="$1"
  version="$2"
  platform="$OSTYPE-$CPUTYPE"
  astral_platform="$(astral_cpu)-$(astral_os)"

  case "$astral_platform" in
    aarch64-apple-darwin)      sha256=cb6d2948384a857321f2aa40fa67744cd9676a330f08b6dad7070bda0b6120a4;;
    x86_64-apple-darwin)       sha256=47e1557d93a42585972772e82661047ca5f608293158acb2778dccf120eabb00;;
    x86_64-unknown-linux-gnu)  sha256=e26247302bc8e9083a43ce9e8dd94905b40d464745b1603041f7bc9a93c65d05;;
    aarch64-unknown-linux-gnu) sha256=2e84fc53f4e90e11963281c5c871f593abcb24fc796a50337fa516be99af02fb;;
    *)
      error "Unexpected platform; please ask in #discuss-dev-infra or contact <team-devenv@sentry.io>: ($platform -> $astral_platform)"
      ;;
  esac


  tarball="cpython-$version+$release-$astral_platform-install_only.tar.gz"
  src="https://github.com/astral-sh/python-build-standalone/releases/download/$release/$tarball" \
  dst="$SNTY_DEVENV_CACHE/${tarball}"
  if check_checksum "$sha256" "$dst"; then
    echo "Using cached python download..."
  else
    mkdir -p "$(dirname "$dst")"
    http-get "$src" > "$dst"
    check_checksum "$sha256" "$dst"
  fi

  mkdir -p "$SNTY_DEVENV_HOME/python${version}"
  tar --strip-components=1 -C "$SNTY_DEVENV_HOME/python${version}" -x -f "${SNTY_DEVENV_CACHE}/${tarball}"
  ln -sfn "$SNTY_DEVENV_HOME/python${version}" "$SNTY_DEVENV_HOME/python"
}

find_uv() {
  PATH="$ORIG_PATH:${XDG_BIN_HOME:-$HOME/.local/bin}:/opt/homebrew/bin:/usr/local/bin" \
    command -v uv
}

ensure_uv() {
  # devenv doesn't manage uv, but it needs one to install itself.
  if ! uv="$(find_uv)"; then
    info "uv not found, installing the latest uv (https://docs.astral.sh/uv/)..."
    http-get https://astral.sh/uv/install.sh | sh
    uv="$(find_uv)" || error "Failed to install uv; please install it yourself (brew install uv) and try again."
  fi
  show "$uv" --version
}

main() {
  constants
  parseopt "$@"
  devenv_bin="${SNTY_DEVENV_HOME:?}/bin"  # :? causes an error on empty-string
  devenv_venv="$SNTY_DEVENV_HOME/venv"
  devenv_python="$SNTY_DEVENV_HOME/python/bin/python3"

  info "Installing dependencies..."
  ensure_uv
  install_python "$SNTY_DEVENV_PY_RELEASE" "$SNTY_DEVENV_PY_VERSION"

  rm -rf "$devenv_venv"
  show "$uv" venv --python "$devenv_python" "$devenv_venv"

  if [[ "${CI:-}" ]]; then
    show "$uv" pip install --python "$devenv_venv/bin/python" \
      "git+$SNTY_DEVENV_REPO@$SNTY_DEVENV_BRANCH"
  else
    show "$uv" pip install --python "$devenv_venv/bin/python" \
      --index-url https://pypi.devinfra.sentry.io/simple \
      sentry-devenv
  fi

  rm -rf "$devenv_bin"
  mkdir -p "$devenv_bin"
  ln -sfn "$devenv_venv/bin/devenv" "$devenv_bin/"
  info "devenv installed, at: $devenv_bin/devenv\n"

  export="export PATH=\"$devenv_bin:\$PATH\""
  if [[ -e ~/.zshrc ]] && grep -qFx "$export" ~/.zshrc; then
    : 'already done!'
  elif yesno "Modify your shell startup files to include ${HOME}/.local/share/sentry-devenv/bin/ on your PATH?\nIf you prefer to modify PATH in your own way, say n"; then
    echo "$export" >> ~/.profile
    echo "$export" >> ~/.bash_profile
    echo "$export" >> ~/.bashrc
    echo "$export" >> ~/.zshrc
    mkdir -p "$XDG_CONFIG_HOME/fish/conf.d"
    echo 'set -x PATH '"$devenv_bin"' $PATH' > "$XDG_CONFIG_HOME/fish/conf.d/devenv.fish"
  else
    warn 'Skipped. You may want to add this to your $PATH yourself: '"$devenv_bin"
  fi

  ## fin
  info "All done!\nIf you're on a new laptop, run 'devenv bootstrap' to create your sentry development environment."
  : start a new login shell, to get fresh env:
  show "$SHELL" -l
}

if [[ "$ME" = "install-devenv.sh" ]]; then
  set -eEuo pipefail
  main "$@"
else
  : This file is being sourced as a library, for testing.
fi
