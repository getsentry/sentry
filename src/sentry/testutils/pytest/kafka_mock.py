"""
Pytest plugin that mocks Kafka producers when Kafka is unavailable.

When SENTRY_MOCK_KAFKA_PRODUCERS=1 is set, patches SingletonProducer.produce
to return immediately-resolved futures instead of actually producing to Kafka.

This is used in Tier 1 CI (Postgres + Redis only) where Kafka is not running.
Tier 1 tests don't explicitly need Kafka, but application code (e.g.,
invalidate_project_config via on_commit hooks) triggers Kafka produces as a
side effect of normal Django model operations.

Without this mock, those produces accumulate failed futures in SingletonProducer
and eventually block with MSG_TIMED_OUT when the future queue fills up.

If this approach proves problematic, an alternative is to start a real Kafka
container via GitHub Actions services: block (~10-15s startup). See
docs/service-classification-investigation.md for full tradeoff analysis.
"""

from __future__ import annotations

import os
from concurrent.futures import Future
from typing import Any
from unittest import mock

_mock_active = False
_patches: list[Any] = []


def _make_resolved_future(value: Any = None) -> Future:
    """Create a Future that is already resolved."""
    f: Future = Future()
    f.set_result(value)
    return f


def pytest_configure(config: object) -> None:
    global _mock_active
    if os.environ.get("SENTRY_MOCK_KAFKA_PRODUCERS") == "1":
        _mock_active = True
        _install_kafka_mock()


def pytest_unconfigure(config: object) -> None:
    if _mock_active:
        _uninstall_kafka_mock()


def _install_kafka_mock() -> None:
    """Mock SingletonProducer.produce to return resolved futures."""
    from sentry.utils.arroyo_producer import SingletonProducer

    patch = mock.patch.object(
        SingletonProducer,
        "produce",
        side_effect=lambda *args, **kwargs: _make_resolved_future(),
    )
    _patches.append(patch)
    patch.start()


def _uninstall_kafka_mock() -> None:
    for patch in _patches:
        patch.stop()
    _patches.clear()
