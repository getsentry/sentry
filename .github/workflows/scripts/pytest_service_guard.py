"""pytest plugin that tracks which tests use Snuba, ClickHouse, Kafka or Symbolicator.

Loaded by pytest-selected.py (in xdist workers too) when
BACKEND_TEST_SERVICE_GUARD is set:

- `record`: services are up. Note which test files connect to them and write
  .artifacts/service-usage/<worker>.json, which backend-test-services.py turns
  into backend-test-services.json.
- `enforce`: services are down ("lite" shards). Any connection attempt fails
  that test phase with ServiceGuardError, even if the code under test catches
  the connection error, so a test can never pass on a lite shard by silently
  skipping its Snuba work.

Snuba, ClickHouse and Symbolicator are reached over Python sockets, so a
socket.connect hook sees every one of them, including the urllib3 pool in
sentry.utils.snuba and the `_requires_*` port probes. librdkafka opens its own
sockets, so Kafka clients count as used when they are constructed. Mocked
traffic (`responses`, `mock.patch`) never reaches a socket and doesn't count.
"""

from __future__ import annotations

import json
import os
import socket
import sys
from collections.abc import Generator
from pathlib import Path
from typing import Any

import pytest

MODE = os.environ.get("BACKEND_TEST_SERVICE_GUARD", "")
# Loopback ports of the services that lite shards don't start (devservices
# backend-ci vs backend-ci-lite). 1230-1236 are the per-worker Snuba APIs from
# bootstrap-snuba.py and sentry.testutils.pytest.xdist.
SERVICE_PORTS = {
    1218: "snuba",
    **{port: "snuba" for port in range(1230, 1237)},
    8123: "clickhouse",
    9000: "clickhouse",
    9092: "kafka",
    9093: "kafka",
    3021: "symbolicator",
}
LOOPBACK = {"127.0.0.1", "::1", "localhost"}
# Fixtures that start containers needing those services (Relay produces to Kafka).
SERVICE_FIXTURES = {"relay_server", "relay_server_setup", "_requires_symbolicator"}


class ServiceGuardError(ConnectionRefusedError):
    pass


_current: str = "<outside a test>"
_hits: list[tuple[str, str]] = []
_ran: set[str] = set()


def _hit(service: str) -> None:
    _hits.append((_current, service))
    if MODE == "enforce":
        raise ServiceGuardError(f"{service} is not available on this shard")


def _service_for(address: Any) -> str | None:
    if isinstance(address, tuple) and len(address) >= 2 and address[0] in LOOPBACK:
        return SERVICE_PORTS.get(address[1])
    return None


def _install_socket_hook() -> None:
    connect, connect_ex = socket.socket.connect, socket.socket.connect_ex

    def guarded_connect(self: socket.socket, address: Any) -> None:
        if service := _service_for(address):
            _hit(service)
        return connect(self, address)

    def guarded_connect_ex(self: socket.socket, address: Any) -> int:
        if service := _service_for(address):
            _hit(service)
        return connect_ex(self, address)

    socket.socket.connect = guarded_connect  # type: ignore[method-assign,assignment]
    socket.socket.connect_ex = guarded_connect_ex  # type: ignore[method-assign,assignment]


def _install_kafka_hook() -> None:
    # Before sentry or arroyo import these names: PYTEST_PLUGINS loads this
    # plugin ahead of tests/conftest.py. pytest_configure checks it worked.
    import confluent_kafka
    import confluent_kafka.admin

    def guarded(base: type) -> type:
        class Guarded(base):  # type: ignore[misc]
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                _hit("kafka")
                super().__init__(*args, **kwargs)

        Guarded._guarded = True
        Guarded.__name__ = Guarded.__qualname__ = base.__name__
        Guarded.__module__ = base.__module__
        return Guarded

    # Producer and Consumer are C types, so wrap them in subclasses.
    for name in ("Producer", "Consumer"):
        setattr(confluent_kafka, name, guarded(getattr(confluent_kafka, name)))

    # AdminClient.__init__ calls super(AdminClient, self) by its module global
    # name, so a subclass under that name would recurse. Wrap it in place.
    admin = confluent_kafka.admin.AdminClient
    admin_init = admin.__init__

    def guarded_admin_init(self: Any, *args: Any, **kwargs: Any) -> None:
        _hit("kafka")
        admin_init(self, *args, **kwargs)

    admin.__init__ = guarded_admin_init  # type: ignore[method-assign]
    admin._guarded = True  # type: ignore[attr-defined]


if MODE:
    if MODE not in ("record", "enforce"):
        raise ValueError(f"BACKEND_TEST_SERVICE_GUARD must be record or enforce, got {MODE!r}")
    _install_socket_hook()
    _install_kafka_hook()


def _file(item: pytest.Item) -> str:
    return item.nodeid.split("::", 1)[0]


# Modules that bind confluent_kafka classes at import time.
KAFKA_IMPORTERS = {
    "arroyo.backends.kafka.consumer": ("ConfluentKafkaProducer", "ConfluentConsumer"),
    "sentry.utils.confluent_producer": ("Producer",),
    "sentry.testutils.pytest.kafka": ("Producer", "AdminClient"),
}


def pytest_configure(config: pytest.Config) -> None:
    if not MODE:
        return
    for module, names in KAFKA_IMPORTERS.items():
        for name in names:
            if module in sys.modules and not hasattr(
                getattr(sys.modules[module], name), "_guarded"
            ):
                raise pytest.UsageError(
                    f"pytest_service_guard: {module}.{name} was imported before the Kafka "
                    "hook, so Kafka use can't be tracked; load this plugin earlier"
                )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if MODE != "enforce":
        return
    for item in items:
        needed = SERVICE_FIXTURES.intersection(getattr(item, "fixturenames", ()))
        if needed:
            raise pytest.UsageError(
                f"pytest_service_guard: {item.nodeid} needs {sorted(needed)}, which lite "
                "shards don't run. Add '# backend-ci: snuba' to that test file."
            )


def _guard_phase(item: pytest.Item) -> Generator[None, Any, Any]:
    global _current
    _current = _file(item)
    _ran.add(_current)
    start = len(_hits)
    try:
        result = yield
    except BaseException as exc:
        if MODE == "enforce" and len(_hits) > start:
            raise ServiceGuardError(_message(item, start)) from exc
        raise
    # The code under test may have caught the connection error and passed.
    if MODE == "enforce" and len(_hits) > start:
        raise ServiceGuardError(_message(item, start))
    return result


def _message(item: pytest.Item, start: int) -> str:
    services = sorted({service for _, service in _hits[start:]})
    return (
        f"{item.nodeid} used {', '.join(services)} on a lite shard, which doesn't run "
        f"it. Add '# backend-ci: snuba' to {_file(item)}, or mark it [\"snuba\"] in "
        ".github/workflows/scripts/backend-test-services.json."
    )


if MODE:
    pytest_runtest_setup = pytest.hookimpl(wrapper=True)(_guard_phase)
    pytest_runtest_call = pytest.hookimpl(wrapper=True)(_guard_phase)
    pytest_runtest_teardown = pytest.hookimpl(wrapper=True)(_guard_phase)


def pytest_sessionfinish(session: pytest.Session) -> None:
    if not MODE or not (_ran or _hits):
        return
    used: dict[str, set[str]] = {path: set() for path in _ran}
    for path, service in _hits:
        used.setdefault(path, set()).add(service)
    out = Path(".artifacts/service-usage")
    out.mkdir(parents=True, exist_ok=True)
    worker = os.environ.get("PYTEST_XDIST_WORKER", "main")
    (out / f"{worker}.json").write_text(
        json.dumps({"mode": MODE, "files": {p: sorted(s) for p, s in sorted(used.items())}})
    )
