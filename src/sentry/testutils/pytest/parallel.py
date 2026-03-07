"""Sentry-specific hooks for the pytest-parallel plugin.

Provides ClickHouse reset, env var stripping, and slot limits.
"""

from __future__ import annotations

import pytest


def pytest_parallel_max_slots() -> int:
    from sentry.testutils.pytest.isolation import _MAX_SLOTS

    return _MAX_SLOTS


def pytest_parallel_pre_spawn(config: pytest.Config, num_workers: int) -> None:
    """Drop and recreate all ClickHouse tables via Snuba's test endpoints."""
    from concurrent.futures import ThreadPoolExecutor

    import requests
    from django.conf import settings

    snuba = settings.SENTRY_SNUBA
    endpoints = [
        "/tests/events_analytics_platform/drop",
        "/tests/spans/drop",
        "/tests/events/drop",
        "/tests/functions/drop",
        "/tests/groupedmessage/drop",
        "/tests/transactions/drop",
        "/tests/metrics/drop",
        "/tests/generic_metrics/drop",
        "/tests/search_issues/drop",
        "/tests/group_attributes/drop",
    ]
    results = list(
        ThreadPoolExecutor(len(endpoints)).map(lambda ep: requests.post(snuba + ep), endpoints)
    )
    assert all(r.status_code == 200 for r in results)


def pytest_parallel_worker_env(env: dict[str, str], worker_id: int) -> None:
    env.pop("SENTRY_PYTEST_SERIAL", None)
    env.pop("DJANGO_SETTINGS_MODULE", None)
    env["SENTRY_TEST_WORKER_ID"] = str(worker_id)
