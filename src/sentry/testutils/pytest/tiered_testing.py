"""
Pytest plugin for tiered testing - filter tests based on service requirements.

This plugin allows running tests filtered by tier:
- tier1: DB-only tests (postgres, redis)
- tier2: Snuba tests (needs kafka, clickhouse, snuba)
- tier3: Full stack tests (needs symbolicator)

Usage:
    TEST_TIER=tier1 pytest tests/
    TEST_TIER=tier2 pytest tests/

The tier is determined by:
1. Test file path (tests/snuba/* -> tier2, tests/symbolicator/* -> tier3)
2. Test class base classes (SnubaTestCase -> tier2)
3. Markers (requires_snuba, requires_kafka, requires_symbolicator)
"""

from __future__ import annotations

import os
import re
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

if TYPE_CHECKING:
    from _pytest.config import Config
    from _pytest.nodes import Item

# Base classes that indicate Snuba requirement
SNUBA_BASE_CLASSES = {
    "SnubaTestCase",
    "BaseMetricsLayerTestCase",
    "MetricsEnhancedPerformanceTestCase",
    "ProfilesSnubaTestCase",
    "ReplaysSnubaTestCase",
    "OutcomesSnubaTest",
    "BaseMetricsTestCase",
}

# Directories that implicitly require certain services
SNUBA_DIR_PATTERNS = [
    r"^tests/snuba/",
    r"^tests/relay_integration/",
    r"^tests/integration/",
]

SYMBOLICATOR_DIR_PATTERNS = [
    r"^tests/symbolicator/",
]


def _get_test_tier(item: Item) -> str:
    """
    Determine the tier for a test item.

    Returns: 'tier1', 'tier2', or 'tier3'
    """
    nodeid = item.nodeid

    # Check directory-based classification first
    for pattern in SYMBOLICATOR_DIR_PATTERNS:
        if re.match(pattern, nodeid):
            return "tier3"

    for pattern in SNUBA_DIR_PATTERNS:
        if re.match(pattern, nodeid):
            return "tier2"

    # Check for symbolicator marker/fixture
    if item.get_closest_marker("usefixtures"):
        for marker in item.iter_markers("usefixtures"):
            if "_requires_symbolicator" in marker.args:
                return "tier3"

    # Check for snuba marker/fixture
    if item.get_closest_marker("snuba"):
        return "tier2"

    if item.get_closest_marker("usefixtures"):
        for marker in item.iter_markers("usefixtures"):
            if "_requires_snuba" in marker.args or "_requires_kafka" in marker.args:
                return "tier2"

    # Check class inheritance
    # item.cls is available on Function items (test methods/functions)
    item_cls = getattr(item, "cls", None)
    if item_cls is not None:
        for cls in item_cls.__mro__:
            if cls.__name__ in SNUBA_BASE_CLASSES:
                return "tier2"

    # Default to tier1
    return "tier1"


def pytest_configure(config: Config) -> None:
    """Register the tier marker."""
    config.addinivalue_line(
        "markers",
        "tier(name): mark test to run only in a specific tier (tier1, tier2, tier3)",
    )


def pytest_collection_modifyitems(config: Config, items: list[Item]) -> None:
    """Filter tests based on TEST_TIER environment variable."""
    test_tier = os.environ.get("TEST_TIER", "").lower()

    if not test_tier or test_tier == "all":
        # No filtering, run all tests
        return

    if test_tier not in ("tier1", "tier2", "tier3"):
        raise ValueError(
            f"Invalid TEST_TIER value: {test_tier}. Must be tier1, tier2, tier3, or all"
        )

    keep = []
    skip = []

    for item in items:
        item_tier = _get_test_tier(item)

        if item_tier == test_tier:
            keep.append(item)
        else:
            skip.append(item)

    # Update items in place
    items[:] = keep

    # Report deselected tests
    if skip:
        config.hook.pytest_deselected(items=skip)


def pytest_report_header(config: Config) -> list[str]:
    """Report the tier being tested."""
    test_tier = os.environ.get("TEST_TIER", "all")
    return [f"Test tier: {test_tier}"]


class MockSnubaResponse:
    """Mock response for Snuba HTTP calls."""

    status = 200
    data = b"[]"

    def read(self) -> bytes:
        return self.data


@pytest.fixture(autouse=True)
def _mock_snuba_for_tier1(request):
    """
    Auto-mock Snuba connections for tier1 tests.

    When running tier1 tests, Snuba is not available, but some code paths
    (like Django signals) may try to write to Snuba. This fixture mocks
    those calls to prevent connection errors.
    """
    test_tier = os.environ.get("TEST_TIER", "").lower()

    if test_tier != "tier1":
        # Not tier1, don't mock anything
        yield
        return

    # Mock the Snuba pool to return success without actually connecting
    mock_response = MockSnubaResponse()

    with patch("sentry.utils.snuba._snuba_pool") as mock_pool:
        mock_pool.urlopen.return_value = mock_response
        yield
