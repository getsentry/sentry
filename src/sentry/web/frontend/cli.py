from urllib.parse import quote_plus

from django.http import HttpRequest, HttpResponse, HttpResponseRedirect

from sentry.utils import metrics
from sentry.web.decorators import ai_machine_readable
from sentry.web.frontend.base import control_silo_view

RELEASE_REGISTRY_URL = "https://release-registry.services.sentry.io/apps"

# The last sentry-cli v3 release. It serves the platforms that v4 has no build for.
LEGACY_CLI_VERSION = "3.8.2"

# Sentry CLI v4 builds, by (platform, arch) as the release registry names them.
V4_BUILDS = frozenset(
    {
        ("darwin", "arm64"),
        ("darwin", "x64"),
        ("linux", "arm64"),
        ("linux", "x64"),
        ("windows", "x64"),
    }
)

# v3 (`uname -m`) and v4 arch names, mapped to v4 names.
V4_ARCHS = {"x86_64": "x64", "amd64": "x64", "x64": "x64", "aarch64": "arm64", "arm64": "arm64"}

# Served as a POSIX sh script, not a redirect to the v4 installer: people pipe it to
# `sh`, and some clients (such as sentry-wizard) fetch it without following redirects.
SCRIPT = r"""#!/bin/sh
# Installs the Sentry CLI.
#
#   curl -sL https://sentry.io/get-cli/ | sh
#
# This installs Sentry CLI v4 (`sentry`) with https://cli.sentry.dev/install,
# which needs bash. A SENTRY_CLI_VERSION below 4 installs the legacy
# `sentry-cli` binary instead, so pinned installs keep working.
#
# Environment variables:
#   SENTRY_CLI_VERSION  Version to install: latest (default), nightly, or a version
#   SENTRY_INSTALL_DIR  Install directory for v4
#   INSTALL_DIR         Install directory; v4 uses it when SENTRY_INSTALL_DIR is unset
#   INSTALL_PATH        Path of the legacy sentry-cli binary; v4 uses its directory
#
# v4 also reads the variables that https://cli.sentry.dev/install documents.
set -eu

V4_INSTALLER_URL="https://cli.sentry.dev/install"
LEGACY_DOWNLOAD_URL="https://release-registry.services.sentry.io/apps/sentry-cli"

main() {
  version=${SENTRY_CLI_VERSION:-latest}
  require_curl
  case "$version" in
    [0-3].*|v[0-3].*) install_legacy "${version#v}" ;;
    *) install_v4 "$version" ;;
  esac
}

require_curl() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "error: you do not have 'curl' installed which is required for this script." >&2
    exit 1
  fi
}

install_v4() {
  if ! command -v bash >/dev/null 2>&1; then
    echo "error: the Sentry CLI installer needs bash. Install bash, or run: npm install -g sentry" >&2
    exit 1
  fi

  if [ "$1" != "latest" ]; then
    SENTRY_VERSION=$1
    export SENTRY_VERSION
  fi
  if [ -z "${SENTRY_INSTALL_DIR:-}" ]; then
    if [ -n "${INSTALL_DIR:-}" ]; then
      SENTRY_INSTALL_DIR=$INSTALL_DIR
      export SENTRY_INSTALL_DIR
    elif [ -n "${INSTALL_PATH:-}" ]; then
      SENTRY_INSTALL_DIR=$(dirname "$INSTALL_PATH")
      export SENTRY_INSTALL_DIR
    fi
  fi

  installer=$(mktemp "${TMPDIR:-/tmp}/.sentry-install.XXXXXXXX")
  trap 'rm -f "$installer"' EXIT
  trap 'exit 1' INT TERM
  curl -fsSL --retry 3 --max-time 60 "$V4_INSTALLER_URL" -o "$installer"
  bash "$installer"

  echo "The Sentry CLI now runs as 'sentry' and replaces 'sentry-cli'."
  echo "To update scripts that call sentry-cli, see https://cli.sentry.dev/migrating-from-v3/"
}

install_legacy() {
  version=$1
  platform=$(uname -s)
  arch=$(uname -m)

  case "$platform" in
    CYGWIN*|MINGW*|MSYS*) platform="Windows" ;;
    Darwin) arch="universal" ;;
  esac
  case "$arch" in
    armv8*|armv64*|aarch64*) arch="aarch64" ;;
    armv6*|armv7*) arch="armv7" ;;
  esac

  install_path=${INSTALL_PATH:-${INSTALL_DIR:-/usr/local/bin}/sentry-cli}
  download_url="${LEGACY_DOWNLOAD_URL}/${version}?response=download&arch=${arch}&platform=${platform}&package=sentry-cli"

  echo "This script will automatically install sentry-cli (${version}) for you."
  echo "Installation path: ${install_path}"
  uid=$(id -u)
  if [ "$uid" = "0" ]; then
    echo "Warning: this script is currently running as root. This is dangerous. "
    echo "         Instead run it as normal user. We will sudo as needed."
  fi

  if [ -f "$install_path" ]; then
    echo "error: sentry-cli is already installed."
    echo "  run \"sentry-cli update\" to update to latest version"
    exit 1
  fi

  binary=$(mktemp "${TMPDIR:-/tmp}/.sentrycli.XXXXXXXX")
  headers=$(mktemp "${TMPDIR:-/tmp}/.sentrycli-headers.XXXXXXXX")
  trap 'rm -f "$binary" "$headers"' EXIT
  trap 'exit 1' INT TERM

  http_code=$(curl -SL --progress-bar "$download_url" -D "$headers" --output "$binary" --write-out "%{http_code}")
  if [ "$http_code" -lt 200 ] || [ "$http_code" -gt 299 ]; then
    echo "error: your platform and architecture (${platform}-${arch}) is unsupported."
    exit 1
  fi
  verify_legacy_checksum "$binary" "$headers"

  chmod 0755 "$binary"
  install_dir=$(dirname "$install_path")
  if ! (mkdir -p "$install_dir" && mv "$binary" "$install_path") 2>/dev/null; then
    sudo -k sh -c 'mkdir -p "$1" && mv "$2" "$3"' sh "$install_dir" "$binary" "$install_path"
  fi

  installed=$("$install_path" --version)
  echo "Successfully installed ${installed}"

  # `sentry-cli 2.42.1` -> major 2, minor 42
  installed_version=${installed#* }
  major=${installed_version%%.*}
  minor=${installed_version#*.}
  minor=${minor%%.*}
  if [ -d "${HOME:-}/.oh-my-zsh" ] && [ "$major" -eq 2 ] && [ "$minor" -ge 22 ]; then
    echo 'Detected Oh My Zsh, installing Zsh completions...'
    if mkdir -p "${HOME}/.oh-my-zsh/completions" && "$install_path" completions zsh > "${HOME}/.oh-my-zsh/completions/_sentry_cli"; then
      echo "Successfully installed Zsh completions."
    else
      echo 'Warning: failed to install Zsh completions.'
    fi
  fi

  echo 'Done!'
}

# Usage: verify_legacy_checksum <file> <headers-file>. Checks the file against
# the Digest header that the release registry sends.
verify_legacy_checksum() {
  python=""
  for candidate in python3 python2 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      python=$candidate
      break
    fi
  done
  if [ -z "$python" ]; then
    echo "warning: python not available, unable to verify checksums"
    return 0
  fi

  "$python" - "$1" "$2" <<'EOF'
import binascii
import hashlib
import re
import sys

validated = False
with open(sys.argv[2], "r") as f:
    for line in f:
        match = re.search("(?i)^digest:.?sha256=([^,\n ]+)", line)
        if match is not None:
            with open(sys.argv[1], "rb") as downloaded:
                hasher = hashlib.sha256()
                while True:
                    chunk = downloaded.read(4096)
                    if not chunk:
                        break
                    hasher.update(chunk)
                calculated = hasher.digest()
                expected = binascii.a2b_base64(match.group(1))
                if calculated != expected:
                    print("error: checksum mismatch (got %s, expected %s)" % (
                        binascii.b2a_hex(calculated).decode("ascii"),
                        binascii.b2a_hex(expected).decode("ascii")
                    ))
                    sys.exit(1)
                validated = True
                break
if not validated:
    print("warning: unable to validate checksum because no checksum available")
EOF
}

main
"""


@control_silo_view
@ai_machine_readable
def get_cli(request: HttpRequest) -> HttpResponse:
    metrics.incr("cli.download_script")
    return HttpResponse(SCRIPT, content_type="text/plain")


@control_silo_view
@ai_machine_readable
def get_cli_download_url(request: HttpRequest, platform: str, arch: str) -> HttpResponseRedirect:
    v4_platform = platform.lower()
    v4_arch = V4_ARCHS.get(arch.lower())
    if (v4_platform, v4_arch) in V4_BUILDS:
        url = f"{RELEASE_REGISTRY_URL}/sentry/latest?response=download&arch={v4_arch}&platform={v4_platform}&package=sentry"
    else:
        url = f"{RELEASE_REGISTRY_URL}/sentry-cli/{LEGACY_CLI_VERSION}?response=download&arch={quote_plus(arch)}&platform={quote_plus(platform)}&package=sentry-cli"
    return HttpResponseRedirect(url)
