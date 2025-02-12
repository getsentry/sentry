from __future__ import annotations

import socket
from urllib.parse import urlparse

import pytest
from django.conf import settings


def _service_available(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), 1.0):
            pass
    except OSError:
        return False
    else:
        return True


def _requires_service_message(name: str) -> str:
    if name == "symbolicator":
        return (
            f"requires '{name}' server running\n\t💡 Hint: run `devservices up --mode=symbolicator`"
        )
    return f"requires '{name}' server running\n\t💡 Hint: run `devservices up`"


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
