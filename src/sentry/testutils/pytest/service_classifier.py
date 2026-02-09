"""
Pytest plugin that classifies tests by their external service dependencies.

Uses a hybrid approach:
- **Runtime detection** (socket monitoring) for Snuba, Redis, Redis Cluster
- **Static detection** (markers/fixtures) for Kafka, Symbolicator, Objectstore, Bigtable, Postgres

Enable with: pytest --classify-services
Output: test-service-classification.json

See docs/service-classification-investigation.md for the full design rationale.
"""

from __future__ import annotations

import json  # noqa: S003 - need stdlib json for indent support in report output
import socket
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import pytest

# --- Port-to-service mapping for runtime detection ---
# These are the default ports used by devservices on localhost.
SERVICE_PORTS: dict[int, str] = {
    # Redis
    6379: "redis",
    # Redis Cluster
    7000: "redis-cluster",
    7001: "redis-cluster",
    7002: "redis-cluster",
    7003: "redis-cluster",
    7004: "redis-cluster",
    7005: "redis-cluster",
    # Snuba (covers all 4 HTTP paths: main pool, replays EAP pool, requests.post, snuba_rpc)
    1218: "snuba",
}

# --- Static detection: known fixture names that indicate service requirements ---
FIXTURE_SERVICE_MAP: dict[str, str] = {
    "_requires_snuba": "snuba",
    "_requires_kafka": "kafka",
    "_requires_symbolicator": "symbolicator",
    "_requires_objectstore": "objectstore",
}

# --- Static detection: known bigtable test files ---
BIGTABLE_TEST_FILES: set[str] = {
    "tests/sentry/services/nodestore/bigtable/test_backend.py",
    "tests/sentry/services/nodestore/test_common.py",
    "tests/sentry/utils/kvstore/test_bigtable.py",
    "tests/sentry/utils/kvstore/test_common.py",
}

# --- Plugin state ---
_original_send: Any = None
_original_sendall: Any = None
_current_test: str | None = None
_test_services: dict[str, set[str]] = defaultdict(set)
_enabled: bool = False


def _classify_socket(sock: socket.socket) -> None:
    """Check if this socket is connected to a monitored service and record it."""
    if not _current_test:
        return
    try:
        addr = sock.getpeername()
        port = addr[1]
        service = SERVICE_PORTS.get(port)
        if service:
            _test_services[_current_test].add(service)
    except (OSError, AttributeError, IndexError):
        # Socket not connected, or getpeername() failed - ignore
        pass


def _patched_send(self: socket.socket, *args: Any, **kwargs: Any) -> Any:
    _classify_socket(self)
    assert _original_send is not None
    return _original_send(self, *args, **kwargs)


def _patched_sendall(self: socket.socket, *args: Any, **kwargs: Any) -> Any:
    _classify_socket(self)
    assert _original_sendall is not None
    return _original_sendall(self, *args, **kwargs)


def _install_socket_patches() -> None:
    """Monkey-patch socket.send/sendall to monitor service connections."""
    global _original_send, _original_sendall
    _original_send = socket.socket.send
    _original_sendall = socket.socket.sendall
    socket.socket.send = _patched_send  # type: ignore[assignment]
    socket.socket.sendall = _patched_sendall  # type: ignore[assignment]


def _uninstall_socket_patches() -> None:
    """Restore original socket methods."""
    if _original_send is not None:
        socket.socket.send = _original_send  # type: ignore[assignment]
    if _original_sendall is not None:
        socket.socket.sendall = _original_sendall  # type: ignore[assignment]


def _get_test_node_id(item: pytest.Item) -> str:
    """Get a stable test identifier."""
    return item.nodeid


def _detect_static_services(item: pytest.Item) -> set[str]:
    """Detect services needed by a test using static analysis (markers/fixtures)."""
    services: set[str] = set()

    # All TestCase subclasses need Postgres (the baseline)
    test_cls = getattr(item, "cls", None)
    if test_cls is not None:
        services.add("postgres")
    elif hasattr(item, "fixturenames"):
        # Function-level tests that use db fixtures also need postgres
        db_fixtures = {"db", "transactional_db", "django_db_reset_sequences"}
        if db_fixtures & set(item.fixturenames):
            services.add("postgres")

    # Check for service-indicating fixtures
    if hasattr(item, "fixturenames"):
        for fixture_name, service in FIXTURE_SERVICE_MAP.items():
            if fixture_name in item.fixturenames:
                services.add(service)

    # Check for usefixtures markers (e.g., @pytest.mark.usefixtures("_requires_snuba"))
    for marker in item.iter_markers("usefixtures"):
        for fixture_name in marker.args:
            if fixture_name in FIXTURE_SERVICE_MAP:
                services.add(FIXTURE_SERVICE_MAP[fixture_name])

    # Check for bigtable by file path
    rel_path = str(Path(item.fspath).relative_to(Path(item.config.rootpath)))
    if rel_path in BIGTABLE_TEST_FILES:
        services.add("bigtable")

    return services


# --- Pytest hooks ---


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("service-classifier", "Test service classification")
    group.addoption(
        "--classify-services",
        action="store_true",
        default=False,
        help="Enable service dependency classification. Outputs test-service-classification.json",
    )
    group.addoption(
        "--classification-output",
        type=str,
        default="test-service-classification.json",
        help="Output path for classification report (default: test-service-classification.json)",
    )


def pytest_configure(config: pytest.Config) -> None:
    global _enabled
    _enabled = config.getoption("--classify-services", default=False)
    if _enabled:
        _install_socket_patches()


def pytest_unconfigure(config: pytest.Config) -> None:
    if _enabled:
        _uninstall_socket_patches()


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Run static detection on all collected tests."""
    if not _enabled:
        return

    for item in items:
        node_id = _get_test_node_id(item)
        static_services = _detect_static_services(item)
        _test_services[node_id].update(static_services)


@pytest.hookimpl(tryfirst=True)
def pytest_runtest_setup(item: pytest.Item) -> None:
    """Track which test is about to run. tryfirst ensures this runs BEFORE fixture setup."""
    global _current_test
    if _enabled:
        _current_test = _get_test_node_id(item)


@pytest.hookimpl(tryfirst=True)
def pytest_runtest_call(item: pytest.Item) -> None:
    """Ensure _current_test is set during test execution."""
    global _current_test
    if _enabled:
        _current_test = _get_test_node_id(item)


@pytest.hookimpl(trylast=True)
def pytest_runtest_teardown(item: pytest.Item, nextitem: pytest.Item | None) -> None:
    """Clear _current_test AFTER teardown and fixture cleanup."""
    global _current_test
    if _enabled:
        _current_test = None


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    """Write the classification report."""
    if not _enabled:
        return

    output_path = session.config.getoption("--classification-output")

    # Build summary
    service_counts: dict[str, int] = defaultdict(int)
    for services in _test_services.values():
        for service in services:
            service_counts[service] += 1

    # Determine tier for each test
    tier_counts: dict[str, int] = defaultdict(int)
    for node_id, services in _test_services.items():
        if "snuba" in services:
            tier_counts["snuba_tier"] += 1
        elif services - {"postgres"}:
            # Has services beyond just postgres
            tier_counts["other_services"] += 1
        elif "postgres" in services:
            tier_counts["postgres_only"] += 1
        else:
            tier_counts["no_services"] += 1

    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_tests": len(_test_services),
        "summary": {
            "service_counts": dict(service_counts),
            "tier_counts": dict(tier_counts),
        },
        "tests": {
            node_id: sorted(services) for node_id, services in sorted(_test_services.items())
        },
    }

    Path(output_path).write_text(json.dumps(report, indent=2) + "\n")

    # Print summary to terminal
    terminal = session.config.pluginmanager.get_plugin("terminalreporter")
    if terminal:
        terminal.write_line("")
        terminal.write_line("=" * 60)
        terminal.write_line("SERVICE CLASSIFICATION REPORT")
        terminal.write_line("=" * 60)
        terminal.write_line(f"Total tests classified: {len(_test_services)}")
        terminal.write_line("")
        terminal.write_line("Services detected:")
        for service, count in sorted(service_counts.items(), key=lambda x: -x[1]):
            terminal.write_line(f"  {service}: {count} tests")
        terminal.write_line("")
        terminal.write_line("Tier breakdown:")
        for tier, count in sorted(tier_counts.items(), key=lambda x: -x[1]):
            terminal.write_line(f"  {tier}: {count} tests")
        terminal.write_line("")
        terminal.write_line(f"Report written to: {output_path}")
        terminal.write_line("=" * 60)
