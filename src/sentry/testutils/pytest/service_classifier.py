from __future__ import annotations

import json
import socket
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import pytest

SERVICE_PORTS: dict[int, str] = {
    1218: "snuba",
    3021: "symbolicator",
    8086: "bigtable",
    8888: "objectstore",
}

FIXTURE_SERVICE_MAP: dict[str, str] = {
    "_requires_snuba": "snuba",
    "_requires_kafka": "kafka",
    "_requires_symbolicator": "symbolicator",
    "_requires_objectstore": "objectstore",
}

_original_send: Any = None
_original_sendall: Any = None
_current_test: str | None = None
_test_services: dict[str, set[str]] = defaultdict(set)
_enabled: bool = False


def _classify_socket(sock: socket.socket) -> None:
    if not _current_test:
        return
    try:
        service = SERVICE_PORTS.get(sock.getpeername()[1])
        if service:
            _test_services[_current_test].add(service)
    except (OSError, AttributeError, IndexError):
        pass


def _patched_send(self: socket.socket, *args: Any, **kwargs: Any) -> Any:
    _classify_socket(self)
    return _original_send(self, *args, **kwargs)


def _patched_sendall(self: socket.socket, *args: Any, **kwargs: Any) -> Any:
    _classify_socket(self)
    return _original_sendall(self, *args, **kwargs)


def _install_socket_patches() -> None:
    global _original_send, _original_sendall
    _original_send = socket.socket.send
    _original_sendall = socket.socket.sendall
    socket.socket.send = _patched_send  # type: ignore[assignment,method-assign]
    socket.socket.sendall = _patched_sendall  # type: ignore[assignment,method-assign]


def _uninstall_socket_patches() -> None:
    if _original_send is not None:
        socket.socket.send = _original_send  # type: ignore[method-assign]
    if _original_sendall is not None:
        socket.socket.sendall = _original_sendall  # type: ignore[method-assign]


def _detect_static_services(item: pytest.Item) -> set[str]:
    services: set[str] = set()

    if getattr(item, "cls", None) is not None:
        services.add("postgres")
    elif hasattr(item, "fixturenames"):
        if {"db", "transactional_db", "django_db_reset_sequences"} & set(item.fixturenames):
            services.add("postgres")

    if hasattr(item, "fixturenames"):
        for fixture, service in FIXTURE_SERVICE_MAP.items():
            if fixture in item.fixturenames:
                services.add(service)

    for marker in item.iter_markers("usefixtures"):
        for name in marker.args:
            if name in FIXTURE_SERVICE_MAP:
                services.add(FIXTURE_SERVICE_MAP[name])

    return services


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("service-classifier")
    group.addoption("--classify-services", action="store_true", default=False)
    group.addoption("--classification-output", default="test-service-classification.json")


def pytest_configure(config: pytest.Config) -> None:
    global _enabled
    _enabled = config.getoption("--classify-services", default=False)
    if _enabled:
        _install_socket_patches()


def pytest_unconfigure(config: pytest.Config) -> None:
    if _enabled:
        _uninstall_socket_patches()


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if _enabled:
        for item in items:
            _test_services[item.nodeid].update(_detect_static_services(item))


@pytest.hookimpl(tryfirst=True)
def pytest_runtest_setup(item: pytest.Item) -> None:
    global _current_test
    if _enabled:
        _current_test = item.nodeid


@pytest.hookimpl(trylast=True)
def pytest_runtest_teardown(item: pytest.Item, nextitem: pytest.Item | None) -> None:
    global _current_test
    if _enabled:
        _current_test = None


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    if _enabled:
        report = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total_tests": len(_test_services),
            "tests": {nid: sorted(svcs) for nid, svcs in sorted(_test_services.items())},
        }
        Path(session.config.getoption("--classification-output")).write_text(
            json.dumps(report, indent=2) + "\n"
        )
