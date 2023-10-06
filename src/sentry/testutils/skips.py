from __future__ import annotations

import os
import socket
from typing import Any, Callable, TypeVar
from urllib.parse import urlparse

import pytest
from django.conf import settings

from sentry.runner.commands.devservices import check_health, ensure_interface

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


def _service_options(name: str) -> dict[str, Any]:
    options = settings.SENTRY_DEVSERVICES[name](settings, {})
    options["name"] = f"sentry_{name}"
    options["ports"] = ensure_interface(options["ports"])
    return options


@pytest.fixture(scope="session")
def _requires_snuba() -> None:
    parsed = urlparse(settings.SENTRY_SNUBA)
    assert parsed.hostname is not None
    assert parsed.port is not None
    if not _service_available(parsed.hostname, parsed.port):
        pytest.fail("requires snuba server running")

    options = _service_options("snuba")
    try:
        check_health("snuba", options)
    except Exception as e:
        pytest.fail(f"snuba server is not heathy: {e}")


@pytest.fixture(scope="session")
def _requires_kafka() -> None:
    options = _service_options("kafka")
    (port,) = options["ports"].values()

    if not _service_available(port[0], port[1]):
        pytest.skip("requires kafka server running")

    try:
        check_health("kafka", options)
    except Exception as e:
        pytest.fail(f"kafka server is not heathy: {e}")


@pytest.fixture(scope="session")
def _requires_symbolicator() -> None:
    options = _service_options("symbolicator")
    (port,) = options["ports"].values()

    if not _service_available(port[0], port[1]):
        pytest.skip("requires symbolicator server running")

    try:
        check_health("symbolicator", options)
    except Exception as e:
        pytest.fail(f"symbolicator server is not heathy: {e}")


requires_snuba = pytest.mark.usefixtures("_requires_snuba")
requires_symbolicator = pytest.mark.usefixtures("_requires_symbolicator")
requires_kafka = pytest.mark.usefixtures("_requires_kafka")
