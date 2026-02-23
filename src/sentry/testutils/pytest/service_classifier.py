"""
Pytest plugin: classifies tests by external service dependencies.

Hybrid approach — static (fixtures/markers) + runtime (socket monitoring).
Static catches explicitly declared deps (Kafka, Symbolicator, Objectstore).
Runtime catches implicit deps (e.g. Snuba calls buried in application code).

Enable: pytest --classify-services
Output: test-service-classification.json

Database narrowing:
  --classify-databases: monkey-patches BaseDatabaseWrapper.cursor() to record
      which DB aliases each test class actually touches. Output:
      test-database-usage.json  (format: {"classes": {qualname: [alias, ...]}})
  --narrow-databases <path>: reads a test-database-usage.json and patches
      cls.databases at collection time so Django skips unnecessary SAVEPOINTs.
"""

from __future__ import annotations

import json  # noqa: S003 (sentry.utils.json has Django imports; plugin loads pre-Django)
import socket
import time
from collections import defaultdict
from contextvars import ContextVar
from pathlib import Path
from typing import Any

import pytest

# Port-to-service mapping for runtime socket monitoring.
SERVICE_PORTS: dict[int, str] = {
    1218: "snuba",
    3021: "symbolicator",
    8086: "bigtable",
    8888: "objectstore",
}

# Fixture-to-service mapping for static detection.
FIXTURE_SERVICE_MAP: dict[str, str] = {
    "_requires_snuba": "snuba",
    "_requires_kafka": "kafka",
    "_requires_symbolicator": "symbolicator",
    "_requires_objectstore": "objectstore",
}

# --- Service classifier state ---

_original_send: Any = None
_original_sendall: Any = None
_current_test: str | None = None
_test_services: dict[str, set[str]] = defaultdict(set)
_enabled: bool = False

# --- Database classifier state ---

_classify_db_enabled: bool = False
_narrow_db_enabled: bool = False
# ContextVar is safe across async tests and xdist worker threads.
_current_item: ContextVar[pytest.Item | None] = ContextVar("_current_item", default=None)
_db_usage: dict[str, set[str]] = defaultdict(set)
_orig_cursor: Any = None


# --- Socket monitoring (service classifier) ---


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
    return _original_send(self, *args, **kwargs)  # type: ignore[misc]


def _patched_sendall(self: socket.socket, *args: Any, **kwargs: Any) -> Any:
    _classify_socket(self)
    return _original_sendall(self, *args, **kwargs)  # type: ignore[misc]


def _install_socket_patches() -> None:
    global _original_send, _original_sendall
    _original_send = socket.socket.send
    _original_sendall = socket.socket.sendall
    socket.socket.send = _patched_send  # type: ignore[assignment]
    socket.socket.sendall = _patched_sendall  # type: ignore[assignment]


def _uninstall_socket_patches() -> None:
    if _original_send is not None:
        socket.socket.send = _original_send  # type: ignore[assignment]
    if _original_sendall is not None:
        socket.socket.sendall = _original_sendall  # type: ignore[assignment]


# --- Database cursor monitoring (database classifier) ---


def _patched_cursor(self: Any, *args: Any, **kwargs: Any) -> Any:
    item = _current_item.get()
    if item is not None and item.cls is not None:
        _db_usage[item.cls.__qualname__].add(self.alias)
    return _orig_cursor(self, *args, **kwargs)  # type: ignore[misc]


def _install_cursor_patch() -> None:
    global _orig_cursor
    from django.db.backends.base.base import BaseDatabaseWrapper

    _orig_cursor = BaseDatabaseWrapper.cursor
    BaseDatabaseWrapper.cursor = _patched_cursor  # type: ignore[method-assign]


def _uninstall_cursor_patch() -> None:
    if _orig_cursor is not None:
        from django.db.backends.base.base import BaseDatabaseWrapper

        BaseDatabaseWrapper.cursor = _orig_cursor  # type: ignore[method-assign]


# --- Static service detection ---


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


# --- Database narrowing ---


def _apply_db_narrowing(config: pytest.Config, items: list[pytest.Item]) -> None:
    path = Path(config.getoption("--narrow-databases"))
    try:
        data = json.loads(path.read_text())
    except FileNotFoundError:
        return
    db_map: dict[str, list[str]] = data.get("classes", {})
    seen: set[type] = set()
    for item in items:
        cls = item.cls
        if cls is not None and cls not in seen and cls.__qualname__ in db_map:
            cls.databases = tuple(db_map[cls.__qualname__])
            seen.add(cls)


# --- Pytest hooks ---


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("service-classifier")
    group.addoption("--classify-services", action="store_true", default=False)
    group.addoption("--classification-output", default="test-service-classification.json")
    group.addoption("--classify-databases", action="store_true", default=False)
    group.addoption("--database-usage-output", default="test-database-usage.json")
    group.addoption("--narrow-databases", default=None, metavar="PATH")


def pytest_configure(config: pytest.Config) -> None:
    global _enabled, _classify_db_enabled, _narrow_db_enabled
    _enabled = config.getoption("--classify-services", default=False)
    _classify_db_enabled = config.getoption("--classify-databases", default=False)
    _narrow_db_enabled = bool(config.getoption("--narrow-databases", default=None))
    if _enabled:
        _install_socket_patches()
    if _classify_db_enabled:
        _install_cursor_patch()


def pytest_unconfigure(config: pytest.Config) -> None:
    if _enabled:
        _uninstall_socket_patches()
    if _classify_db_enabled:
        _uninstall_cursor_patch()


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if _narrow_db_enabled:
        _apply_db_narrowing(config, items)
    if _enabled:
        for item in items:
            _test_services[item.nodeid].update(_detect_static_services(item))


@pytest.hookimpl(tryfirst=True)
def pytest_runtest_setup(item: pytest.Item) -> None:
    global _current_test
    if _enabled:
        _current_test = item.nodeid
    if _classify_db_enabled:
        _current_item.set(item)


@pytest.hookimpl(trylast=True)
def pytest_runtest_teardown(item: pytest.Item, nextitem: pytest.Item | None) -> None:
    global _current_test
    if _enabled:
        _current_test = None
    if _classify_db_enabled:
        _current_item.set(None)


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

    if _classify_db_enabled:
        report_db = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total_classes": len(_db_usage),
            "classes": {cls: sorted(aliases) for cls, aliases in sorted(_db_usage.items())},
        }
        Path(session.config.getoption("--database-usage-output")).write_text(
            json.dumps(report_db, indent=2) + "\n"
        )
