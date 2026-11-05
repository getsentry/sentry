from collections.abc import Generator

import pytest
from django.core.cache import cache

from sentry.agent_handoff.installer import (
    UNPINNED_INSTALLER_URL,
    PinnedInstaller,
    installer_command,
    pinned_installer,
)
from sentry.tasks.release_registry import APP_INDEX_CACHE_KEY

ENVIRONMENT = "SENTRY_HOST=https://sentry.example.com"
URL = "https://github.com/getsentry/toolkit/releases/download/cli@0.48.0/install"
SHA256 = "a" * 64
INSTALLER = PinnedInstaller(url=URL, version="0.48.0", sha256=SHA256)


def registry_apps(url: object = URL, sha256: object = SHA256) -> dict[str, object]:
    return {
        "sentry": {
            "file_urls": {"install": url},
            "files": {"install": {"checksums": {"sha256-hex": sha256}}},
        }
    }


@pytest.fixture(autouse=True)
def clear_registry_cache() -> Generator[None]:
    cache.delete(APP_INDEX_CACHE_KEY)
    yield
    cache.delete(APP_INDEX_CACHE_KEY)


def test_command_verifies_release_installer_and_pins_its_version() -> None:
    command = installer_command(ENVIRONMENT, INSTALLER)

    assert f'curl -fsSL {URL} -o "$installer"' in command
    assert f'if [ "$checksum" = "{SHA256}" ]; then' in command
    assert f'  {ENVIRONMENT} SENTRY_VERSION=0.48.0 bash "$installer"; status=$?' in command


def test_command_pipes_unpinned_installer_without_a_release_installer() -> None:
    assert installer_command(ENVIRONMENT, None) == (
        f"curl -fsSL {UNPINNED_INSTALLER_URL} | {ENVIRONMENT} bash"
    )


def test_registry_provides_release_installer() -> None:
    cache.set(APP_INDEX_CACHE_KEY, registry_apps())

    assert pinned_installer() == INSTALLER


def test_prerelease_version_is_pinned() -> None:
    url = "https://github.com/getsentry/toolkit/releases/download/cli@0.48.0-beta.1/install"
    cache.set(APP_INDEX_CACHE_KEY, registry_apps(url=url))

    assert pinned_installer() == PinnedInstaller(url=url, version="0.48.0-beta.1", sha256=SHA256)


@pytest.mark.parametrize(
    "apps",
    [
        None,
        {},
        {"sentry": {"file_urls": {}}},
        registry_apps(url=None),
        registry_apps(sha256=None),
        registry_apps(sha256="not-a-checksum"),
        registry_apps(sha256="a" * 63 + "; id"),
        registry_apps(url="https://example.com/install"),
        registry_apps(url=URL + "; id"),
        registry_apps(url=URL.replace("0.48.0", "0.48.0;id")),
        registry_apps(url=URL.replace("0.48.0", "latest")),
    ],
)
def test_unpublished_or_invalid_installer_is_not_used(apps: object) -> None:
    cache.set(APP_INDEX_CACHE_KEY, apps)

    assert pinned_installer() is None
