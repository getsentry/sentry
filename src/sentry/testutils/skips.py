from __future__ import annotations

import os
import socket
from collections.abc import Callable
from typing import Any, TypeVar
from urllib.parse import urlparse

import pytest
from django.conf import settings

T = TypeVar("T", bound=Callable[..., Any])


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


def _requires_service_message(name: str) -> str:
    return f"requires '{name}' server running\n\t💡 Hint: run `sentry devservices up {name}`"


@pytest.fixture(scope="session")
def _requires_snuba() -> None:
    parsed = urlparse(settings.SENTRY_SNUBA)
    assert parsed.hostname is not None
    assert parsed.port is not None
    if not _service_available(parsed.hostname, parsed.port):
        pytest.fail(_requires_service_message("snuba"))


@pytest.fixture(scope="session")
def _requires_kafka() -> None:
    kafka_conf = settings.SENTRY_DEVSERVICES["kafka"](settings, {})
    (port,) = kafka_conf["ports"].values()

    if not _service_available("127.0.0.1", port):
        pytest.fail(_requires_service_message("kafka"))


@pytest.fixture(scope="session")
def _requires_symbolicator() -> None:
    symbolicator_conf = settings.SENTRY_DEVSERVICES["symbolicator"](settings, {})
    (port,) = symbolicator_conf["ports"].values()

    if not _service_available("127.0.0.1", port):
        pytest.fail(_requires_service_message("symbolicator"))


requires_snuba = pytest.mark.usefixtures("_requires_snuba")
requires_symbolicator = pytest.mark.usefixtures("_requires_symbolicator")
requires_kafka = pytest.mark.usefixtures("_requires_kafka")
