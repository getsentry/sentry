from __future__ import annotations

import os
import socket
import time

import pytest


def _service_available(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), 1.0):
            pass
    except OSError:
        return False
    else:
        return True


def _unix_socket_available(path: str) -> bool:
    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(1.0)
        sock.connect(path)
        sock.close()
    except OSError:
        return False
    else:
        return True


def _wait_for_service(host: str, port: int, timeout: int) -> bool:
    """Poll for a service to become available, up to `timeout` seconds."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _service_available(host, port):
            return True
        time.sleep(1)
    return _service_available(host, port)


def _wait_for_unix_socket(path: str, timeout: int) -> bool:
    """Poll for a Unix socket to become available, up to `timeout` seconds."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _unix_socket_available(path):
            return True
        time.sleep(1)
    return _unix_socket_available(path)


def _requires_service_message(name: str) -> str:
    return f"requires '{name}' server running\n\t💡 Hint: run `devservices up`"


@pytest.fixture(scope="session")
def _requires_snuba() -> None:
    snuba_url = os.environ.get("SNUBA", "")
    wait_timeout = int(os.environ.get("SNUBA_WAIT_TIMEOUT", "0"))

    # Unix socket mode: SNUBA is an absolute path (e.g. /tmp/snuba-sock/snuba-gw0.sock)
    if snuba_url.startswith("/"):
        if wait_timeout > 0:
            if _wait_for_unix_socket(snuba_url, wait_timeout):
                return
            pytest.fail(
                f"snuba not available at {snuba_url} after waiting {wait_timeout}s\n"
                + _requires_service_message("snuba")
            )
        if not _unix_socket_available(snuba_url):
            pytest.fail(_requires_service_message("snuba"))
        return

    # TCP mode: parse port from SNUBA URL (default 1218).
    port = 1218
    if snuba_url:
        try:
            from urllib.parse import urlparse

            parsed = urlparse(snuba_url)
            if parsed.port:
                port = parsed.port
        except Exception:
            pass

    # H1 overlapped startup: services may still be starting while pytest
    # collects tests. Wait instead of failing immediately.
    if wait_timeout > 0:
        if _wait_for_service("127.0.0.1", port, wait_timeout):
            return
        pytest.fail(
            f"snuba not available on port {port} after waiting {wait_timeout}s\n"
            + _requires_service_message("snuba")
        )

    if not _service_available("127.0.0.1", port):
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
