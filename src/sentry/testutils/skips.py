from __future__ import annotations

import os
import socket
from typing import Any, Callable, TypeVar
from urllib.parse import urlparse

import pytest
from django.conf import settings

T = TypeVar("T", bound=Callable[..., Any])


def is_arm64() -> bool:
    return os.uname().machine == "arm64"


requires_not_arm64 = pytest.mark.skipif(
    is_arm64(), reason="this test fails in our arm64 testing env"
)


def xfail_if_not_postgres(reason: str) -> Callable[[T], T]:
    def decorator(function: T) -> T:
        return pytest.mark.xfail(os.environ.get("TEST_SUITE") != "postgres", reason=reason)(
            function
        )

    return decorator


def skip_for_relay_store(reason: str) -> Callable[[T], T]:
    """
    Decorator factory will skip marked tests if Relay is enabled.
    A test decorated with @skip_for_relay_store("this test has been moved in relay")
    Will not be executed when the settings SENTRY_USE_RELAY = True
    :param reason: the reason the test should be skipped

    Note: Eventually, when Relay becomes compulsory, tests marked with this decorator will be deleted.
    """

    def decorator(function: T) -> T:
        return pytest.mark.skipif(settings.SENTRY_USE_RELAY, reason=reason)(function)

    return decorator


def _service_available(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), 1.0):
            pass
    except OSError:
        return False
    else:
        return True


@pytest.fixture(scope="session")
def _requires_snuba() -> None:
    parsed = urlparse(settings.SENTRY_SNUBA)
    assert parsed.hostname is not None
    assert parsed.port is not None
    if not _service_available(parsed.hostname, parsed.port):
        pytest.skip("requires snuba server running")


@pytest.fixture(scope="session")
def _requires_relay() -> None:
    if not _service_available("127.0.0.1", settings.SENTRY_RELAY_PORT):
        pytest.skip("requires relay server running")


@pytest.fixture(scope="session")
def _requires_symbolicator() -> None:
    from sentry import options

    parsed = urlparse(options.get("symbolicator.options", True)["url"])
    if not _service_available(parsed.hostname, parsed.port):
        pytest.skip("requires symbolicator server running")


requires_snuba = pytest.mark.usefixtures("_requires_snuba")
requires_relay = pytest.mark.usefixtures("_requires_relay")
requires_symbolicator = pytest.mark.usefixtures("_requires_symbolicator")
