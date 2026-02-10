"""
Pytest plugin that detects which tests READ from ClickHouse via Snuba.

This is a one-shot instrumentation tool to answer: "which tests would break
if store_event() stopped writing to ClickHouse?" Any test that reads from
Snuba but doesn't inherit from SnubaTestCase is a potential silent failure
if we switch the default eventstream to a no-op.

Usage:
    pytest tests --detect-snuba-reads
    # Outputs: snuba-read-detection.json

The output classifies every test that contacts Snuba into:
  - "read": test issued a Snuba QUERY (snql, mql, rpc, etc.)
  - "write_only": test only wrote to Snuba (eventstream insert)
  - "test_infra": test only used test infrastructure (reset_snuba drop endpoints)

Cross-reference the "read" tests against SnubaTestCase subclasses to find
misclassifications that would silently break under Option D.

See docs/service-classification-investigation.md for context.
"""

from __future__ import annotations

import json  # noqa: S003
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import pytest

# --- URL pattern classification ---
# All Snuba HTTP traffic goes through _snuba_pool.urlopen(method, url, ...)
# We classify URLs into reads vs writes vs test infrastructure.

# Write patterns: inserting test data into ClickHouse
_WRITE_URL_PREFIXES = (
    "/tests/events/eventstream",
    "/tests/transactions/eventstream",
    "/tests/search_issues/eventstream",
    "/eap/items/insert",  # EAP_ITEMS_INSERT_ENDPOINT
)

# Test infrastructure: drop/truncate tables (reset_snuba)
_TEST_INFRA_PATTERNS = (
    "/tests/events/drop",
    "/tests/transactions/drop",
    "/tests/spans/drop",
    "/tests/functions/drop",
    "/tests/groupedmessage/drop",
    "/tests/metrics/drop",
    "/tests/generic_metrics/drop",
    "/tests/search_issues/drop",
    "/tests/group_attributes/drop",
    "/tests/events_analytics_platform/drop",
    "/tests/drop_all",
    "/health",
)

# Everything else is a READ (query) — snql, mql, rpc, subscriptions, deletes, etc.
# We don't need to enumerate these; anything not matching write or infra is a read.

# --- Plugin state ---
_original_urlopen: Any = None
_current_test: str | None = None
_current_test_cls: str | None = None
_test_snuba_access: dict[str, set[str]] = defaultdict(set)  # test_id -> {"read", "write", "infra"}
_test_classes: dict[str, str | None] = {}  # test_id -> class name or None
_enabled = False


def _classify_url(url: str) -> str:
    """Classify a Snuba URL as 'read', 'write', or 'infra'."""
    for prefix in _WRITE_URL_PREFIXES:
        if url.startswith(prefix):
            return "write"
    for prefix in _TEST_INFRA_PATTERNS:
        if url.startswith(prefix):
            return "infra"
    # Everything else is a read: /snql, /mql, /rpc/, subscriptions, etc.
    return "read"


def _patched_urlopen(self_pool: Any, method: str, url: str, *args: Any, **kwargs: Any) -> Any:
    """Intercept _snuba_pool.urlopen to record Snuba access patterns."""
    if _current_test:
        access_type = _classify_url(url)
        _test_snuba_access[_current_test].add(access_type)
    assert _original_urlopen is not None
    return _original_urlopen(method, url, *args, **kwargs)


def _install_patch() -> None:
    """Monkey-patch _snuba_pool.urlopen."""
    global _original_urlopen
    from sentry.utils.snuba import _snuba_pool

    _original_urlopen = _snuba_pool.urlopen

    def patched(method: str, url: str, *args: Any, **kwargs: Any) -> Any:
        if _current_test:
            access_type = _classify_url(url)
            _test_snuba_access[_current_test].add(access_type)
        assert _original_urlopen is not None
        return _original_urlopen(method, url, *args, **kwargs)

    _snuba_pool.urlopen = patched  # type: ignore[assignment]


def _uninstall_patch() -> None:
    """Restore original _snuba_pool.urlopen."""
    if _original_urlopen is not None:
        from sentry.utils.snuba import _snuba_pool

        _snuba_pool.urlopen = _original_urlopen  # type: ignore[assignment]


def _is_snuba_test_case(item: pytest.Item) -> bool:
    """Check if this test inherits from SnubaTestCase (or a subclass)."""
    if item.cls is None:
        return False
    return any(base.__name__ == "SnubaTestCase" for base in item.cls.__mro__)


def _has_snuba_marker(item: pytest.Item) -> bool:
    """Check if this test has @pytest.mark.snuba (applied by SnubaTestCase)."""
    return any(mark.name == "snuba" for mark in item.iter_markers())


# --- Pytest hooks ---


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("snuba-read-detector", "Snuba read detection")
    group.addoption(
        "--detect-snuba-reads",
        action="store_true",
        default=False,
        help="Detect which tests read from Snuba/ClickHouse. Outputs snuba-read-detection.json",
    )
    group.addoption(
        "--snuba-read-output",
        type=str,
        default="snuba-read-detection.json",
        help="Output path for snuba read detection report",
    )


def pytest_configure(config: pytest.Config) -> None:
    global _enabled
    _enabled = config.getoption("--detect-snuba-reads", default=False)
    if _enabled:
        _install_patch()


def pytest_unconfigure(config: pytest.Config) -> None:
    if _enabled:
        _uninstall_patch()


@pytest.hookimpl(tryfirst=True)
def pytest_runtest_setup(item: pytest.Item) -> None:
    global _current_test, _current_test_cls
    if _enabled:
        _current_test = item.nodeid
        _current_test_cls = item.cls.__name__ if item.cls else None
        _test_classes[item.nodeid] = _current_test_cls


@pytest.hookimpl(tryfirst=True)
def pytest_runtest_call(item: pytest.Item) -> None:
    global _current_test
    if _enabled:
        _current_test = item.nodeid


@pytest.hookimpl(trylast=True)
def pytest_runtest_teardown(item: pytest.Item, nextitem: pytest.Item | None) -> None:
    global _current_test
    if _enabled:
        _current_test = None


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Record SnubaTestCase status for all collected tests."""
    if not _enabled:
        return
    for item in items:
        _test_classes[item.nodeid] = item.cls.__name__ if item.cls else None


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    """Write the detection report."""
    if not _enabled:
        return

    output_path = session.config.getoption("--snuba-read-output")

    # Classify each test
    readers: list[dict[str, Any]] = []
    writers_only: list[dict[str, Any]] = []
    infra_only: list[dict[str, Any]] = []
    no_snuba: int = 0

    # Also track which readers are NOT SnubaTestCase — these are the misclassifications
    readers_without_snuba_tc: list[dict[str, Any]] = []

    for item in session.items:
        node_id = item.nodeid
        access = _test_snuba_access.get(node_id, set())
        is_snuba_tc = _is_snuba_test_case(item)
        has_marker = _has_snuba_marker(item)
        test_file = node_id.split("::")[0]
        test_cls = _test_classes.get(node_id)

        entry = {
            "test_id": node_id,
            "file": test_file,
            "class": test_cls,
            "is_snuba_test_case": is_snuba_tc,
            "has_snuba_marker": has_marker,
            "access_types": sorted(access),
        }

        if "read" in access:
            readers.append(entry)
            if not is_snuba_tc and not has_marker:
                readers_without_snuba_tc.append(entry)
        elif "write" in access:
            writers_only.append(entry)
        elif "infra" in access:
            infra_only.append(entry)
        else:
            no_snuba += 1

    # Aggregate by file for readability
    reader_files: dict[str, dict[str, Any]] = {}
    for entry in readers:
        f = entry["file"]
        if f not in reader_files:
            reader_files[f] = {
                "file": f,
                "test_count": 0,
                "is_snuba_test_case": entry["is_snuba_test_case"],
                "has_snuba_marker": entry["has_snuba_marker"],
            }
        reader_files[f]["test_count"] += 1

    misclassified_files: dict[str, dict[str, Any]] = {}
    for entry in readers_without_snuba_tc:
        f = entry["file"]
        if f not in misclassified_files:
            misclassified_files[f] = {
                "file": f,
                "class": entry["class"],
                "test_count": 0,
                "tests": [],
            }
        misclassified_files[f]["test_count"] += 1
        misclassified_files[f]["tests"].append(entry["test_id"])

    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_tests_run": len(session.items),
        "summary": {
            "reads_from_snuba": len(readers),
            "writes_only": len(writers_only),
            "infra_only": len(infra_only),
            "no_snuba_contact": no_snuba,
            "readers_without_snuba_test_case": len(readers_without_snuba_tc),
        },
        # THE KEY OUTPUT: files that read from Snuba without SnubaTestCase
        # These would silently break under Option D
        "misclassified_files": sorted(misclassified_files.values(), key=lambda x: -x["test_count"]),
        # All files that read from Snuba (for reference)
        "all_reader_files": sorted(reader_files.values(), key=lambda x: -x["test_count"]),
        # Write-only tests by file (these are safe to skip Snuba writes for)
        "write_only_files": sorted(
            {e["file"] for e in writers_only} - {e["file"] for e in readers}
        ),
    }

    Path(output_path).write_text(json.dumps(report, indent=2) + "\n")

    # Print summary
    tw = session.config.pluginmanager.get_plugin("terminalreporter")
    if tw:
        tw.write_line("")
        tw.write_line("=" * 70)
        tw.write_line("SNUBA READ DETECTION REPORT")
        tw.write_line("=" * 70)
        tw.write_line(f"Total tests run: {len(session.items)}")
        tw.write_line(f"  Reads from Snuba:  {len(readers)} tests")
        tw.write_line(f"  Writes only:       {len(writers_only)} tests")
        tw.write_line(f"  Infra only:        {len(infra_only)} tests")
        tw.write_line(f"  No Snuba contact:  {no_snuba} tests")
        tw.write_line("")
        tw.write_line(
            f"  READERS WITHOUT SnubaTestCase: {len(readers_without_snuba_tc)} tests "
            f"in {len(misclassified_files)} files"
        )
        if misclassified_files:
            tw.write_line("")
            tw.write_line("  *** POTENTIAL MISCLASSIFICATIONS (would silently break) ***")
            for f_info in sorted(misclassified_files.values(), key=lambda x: -x["test_count"]):
                tw.write_line(f"    {f_info['file']} ({f_info['test_count']} tests)")
        else:
            tw.write_line("")
            tw.write_line("  No misclassifications found! Option D is safe.")
        tw.write_line("")
        tw.write_line(f"Report written to: {output_path}")
        tw.write_line("=" * 70)
