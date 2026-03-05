from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from taskbroker_client.metrics import MetricsBackend, Tags

from sentry.utils import metrics as sentry_metrics
from sentry.utils.memory import track_memory_usage as sentry_track_memory_usage


class SentryMetricsBackend(MetricsBackend):
    """
    MetricsBackend implementation that delegates to sentry.utils.metrics.
    """

    def incr(
        self,
        name: str,
        value: int | float = 1,
        tags: Tags | None = None,
        sample_rate: float | None = None,
    ) -> None:
        sentry_metrics.incr(name, amount=int(value), tags=tags, sample_rate=sample_rate or 1.0)

    def distribution(
        self,
        name: str,
        value: int | float,
        tags: Tags | None = None,
        unit: str | None = None,
        sample_rate: float | None = None,
    ) -> None:
        sentry_metrics.distribution(
            name, value=value, tags=tags, unit=unit, sample_rate=sample_rate or 1.0
        )

    @contextmanager
    def timer(
        self,
        key: str,
        tags: Tags | None = None,
        sample_rate: float | None = None,
        stacklevel: int = 0,
    ) -> Generator[None]:
        with sentry_metrics.timer(key, tags=tags, sample_rate=sample_rate or 1.0):
            yield

    @contextmanager
    def track_memory_usage(
        self,
        key: str,
        tags: Tags | None = None,
    ) -> Generator[None]:
        with sentry_track_memory_usage(key, tags=tags):
            yield
