from __future__ import annotations

import socket

import pytest


def _service_available(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), 1.0):
            pass
    except OSError:
        return False
    else:
        return True


def _requires_service_message(name: str) -> str:
    return f"requires '{name}' server running\n\t💡 Hint: run `devservices up`"


@pytest.fixture(scope="session")
def _requires_snuba() -> None:
    # TODO: ability to ask devservices what port a service is on
    if not _service_available("127.0.0.1", 1218):
        pytest.fail(_requires_service_message("snuba"))


@pytest.fixture(scope="session")
def _requires_kafka() -> None:
    # TODO: ability to ask devservices what port a service is on
    if not _service_available("127.0.0.1", 9092):
        pytest.fail(_requires_service_message("kafka"))


@pytest.fixture(scope="session")
def _requires_symbolicator() -> None:
    # TODO: ability to ask devservices what port a service is on
    if not _service_available("127.0.0.1", 3021):
        service_message = "requires 'symbolicator' server running\n\t💡 Hint: run `devservices up --mode=symbolicator`"
        pytest.fail(service_message)


@pytest.fixture(scope="session")
def _requires_objectstore() -> None:
    # TODO: ability to ask devservices what port a service is on
    if not _service_available("127.0.0.1", 8888):
        service_message = "requires 'objectstore' server running\n\t💡 Hint: run `devservices up --mode=objectstore`"
        pytest.fail(service_message)


requires_snuba = pytest.mark.usefixtures("_requires_snuba")
requires_symbolicator = pytest.mark.usefixtures("_requires_symbolicator")
requires_kafka = pytest.mark.usefixtures("_requires_kafka")
requires_objectstore = pytest.mark.usefixtures("_requires_objectstore")
