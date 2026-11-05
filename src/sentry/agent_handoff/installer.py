"""Shell command that installs the Sentry CLI from a runbook.

Each CLI release attaches its `install` script to an immutable GitHub release, and the
release registry lists that asset's URL and SHA-256. The runbook downloads the script
from the latest release, runs it only if it matches the registry checksum, and pins the
CLI to that same release. Tampering with what GitHub serves alone fails verification,
and the installer itself verifies the CLI binary against the registry's checksums.
"""

import re
import shlex
from dataclasses import dataclass

from django.core.cache import cache

from sentry.tasks.release_registry import APP_INDEX_CACHE_KEY

UNPINNED_INSTALLER_URL = "https://cli.sentry.dev/install"

_RELEASE_ASSET_URL = re.compile(
    r"https://github\.com/getsentry/toolkit/releases/download/"
    r"cli@(?P<version>[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)/install"
)
_SHA256_HEX = re.compile(r"[0-9a-f]{64}")


@dataclass(frozen=True)
class PinnedInstaller:
    url: str
    version: str
    sha256: str


def pinned_installer() -> PinnedInstaller | None:
    """The installer from the latest CLI release in the registry, if it has one."""
    apps = cache.get(APP_INDEX_CACHE_KEY)

    try:
        cli = apps["sentry"]
        url = cli["file_urls"]["install"]
        sha256 = cli["files"]["install"]["checksums"]["sha256-hex"]
    except (KeyError, TypeError):
        return None

    # Both values end up in a shell command, so only accept the exact shapes we expect.
    match = _RELEASE_ASSET_URL.fullmatch(url) if isinstance(url, str) else None

    if match is None:
        return None

    if not isinstance(sha256, str) or not _SHA256_HEX.fullmatch(sha256):
        return None

    return PinnedInstaller(url=url, version=match["version"], sha256=sha256)


def installer_command(environment: str, installer: PinnedInstaller | None) -> str:
    """Install the CLI with `environment`, verified and pinned to `installer` if set."""
    if installer is None:
        return f"curl -fsSL {UNPINNED_INSTALLER_URL} | {environment} bash"

    pinned_environment = f"{environment} SENTRY_VERSION={shlex.quote(installer.version)}"

    return "\n".join(
        [
            'installer="$(mktemp)"',
            f'curl -fsSL {shlex.quote(installer.url)} -o "$installer"',
            'checksum="$( (sha256sum "$installer" 2>/dev/null || shasum -a 256 "$installer")'
            " | cut -d ' ' -f 1)\"",
            f'if [ "$checksum" = "{installer.sha256}" ]; then',
            f'  {pinned_environment} bash "$installer"; status=$?',
            "else",
            '  echo "Installer download or checksum check failed; not running it." >&2; status=1',
            "fi",
            'rm -f "$installer"; (exit "$status")',
        ]
    )
