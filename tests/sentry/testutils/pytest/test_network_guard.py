import os
import socket
from collections.abc import Generator
from unittest import mock

import pytest

from sentry.testutils.pytest import network_guard

# TEST-NET-3 (RFC 5737) is reserved for documentation and never routed.
EXTERNAL_IP = "203.0.113.7"


@pytest.fixture
def guard() -> Generator[None]:
    installed = bool(network_guard._originals)
    if not installed:
        network_guard.install()
    try:
        with (
            mock.patch.object(network_guard, "_mode", "strict"),
            mock.patch.object(network_guard, "_current_nodeid", "test-node"),
            mock.patch.object(network_guard, "_records", {}),
        ):
            yield
    finally:
        if not installed:
            network_guard.uninstall()


@pytest.mark.usefixtures("guard")
def test_blocks_external_connect() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        with pytest.raises(network_guard.NetworkAccessBlocked):
            sock.connect((EXTERNAL_IP, 443))
        with pytest.raises(network_guard.NetworkAccessBlocked):
            sock.connect_ex((EXTERNAL_IP, 443))

    [record] = network_guard.get_records()
    assert record["nodeid"] == "test-node"
    assert record["kind"] == "connect"
    assert record["target"] == f"{EXTERNAL_IP}:443"
    assert record["count"] == 2
    assert record["origin"][0].startswith("tests/sentry/testutils/pytest/test_network_guard.py:")


@pytest.mark.usefixtures("guard")
def test_blocks_external_sendto() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        with pytest.raises(network_guard.NetworkAccessBlocked):
            sock.sendto(b"x", (EXTERNAL_IP, 53))
        with pytest.raises(network_guard.NetworkAccessBlocked):
            sock.sendto(b"x", 0, (EXTERNAL_IP, 53))


@pytest.mark.usefixtures("guard")
def test_blocks_external_resolution() -> None:
    with pytest.raises(network_guard.NetworkAccessBlocked):
        socket.getaddrinfo("example.com", 443)
    with pytest.raises(network_guard.NetworkAccessBlocked):
        socket.gethostbyname("example.com")


@pytest.mark.usefixtures("guard")
def test_allows_local_targets() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(("127.0.0.1", 0))
        server.listen(8)
        port = server.getsockname()[1]
        for host in ("127.0.0.1", "localhost", "0.0.0.0"):
            with socket.create_connection((host, port), timeout=1):
                pass

    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.sendto(b"x", ("127.0.0.1", 9))

    assert socket.getaddrinfo(None, 80)
    assert network_guard.get_records() == []


@pytest.mark.parametrize(
    "host",
    [
        "127.0.0.1",
        "127.1.2.3",
        "::1",
        "::ffff:127.0.0.1",
        "0.0.0.0",
        "::",
        "LOCALHOST",
        "localhost.",
    ],
)
def test_local_hosts_allowed(host: str) -> None:
    assert network_guard._host_allowed(host)


@pytest.mark.parametrize("host", [EXTERNAL_IP, "10.0.0.1", "169.254.169.254", "example.com"])
def test_external_hosts_not_allowed(host: str) -> None:
    assert not network_guard._host_allowed(host)


@pytest.mark.usefixtures("guard")
def test_report_mode_records_without_raising() -> None:
    with (
        mock.patch.object(network_guard, "_mode", "report"),
        socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock,
    ):
        sock.setblocking(False)
        try:
            sock.sendto(b"x", (EXTERNAL_IP, 9))
        except OSError:
            pass  # the sandbox may have no route; the attempt is what matters

    [record] = network_guard.get_records()
    assert record["kind"] == "sendto"
    assert record["target"] == f"{EXTERNAL_IP}:9"


@pytest.mark.usefixtures("guard")
def test_inactive_outside_tests() -> None:
    with (
        mock.patch.object(network_guard, "_current_nodeid", None),
        socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock,
    ):
        network_guard._check_address(sock, (EXTERNAL_IP, 443), "connect")
    assert network_guard.get_records() == []


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("172.17.0.1", "172.17.0.1"),
        ("172.17.0.1:8000", "172.17.0.1"),
        ("172.17.0.1:8000-8010", "172.17.0.1"),
        ("", None),
    ],
)
def test_live_server_host(value: str, expected: str | None) -> None:
    with mock.patch.dict(os.environ, {"DJANGO_LIVE_TEST_SERVER_ADDRESS": value}):
        assert network_guard._live_server_host() == expected


@pytest.mark.enable_network(reason="checks that the marker turns the guard off")
def test_enable_network_marker() -> None:
    assert network_guard._current_nodeid is None
