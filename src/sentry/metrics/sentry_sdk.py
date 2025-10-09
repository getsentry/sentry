from typing import Any

import sentry_sdk.metrics

from .base import MetricsBackend, Tags

__all__ = ["SentrySDKMetricsBackend"]


class SentrySDKMetricsBackend(MetricsBackend):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    def incr(
        self,
        key: str,
        instance: str | None = None,
        tags: Tags | None = None,
        amount: float | int = 1,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        if not self._should_sample(sample_rate):
            return

        metric_tags = dict(tags) if tags else {}
        if instance:
            metric_tags["instance"] = instance

        sentry_sdk.metrics.incr(
            key=self._get_key(key),
            value=amount,
            unit=unit or "none",
            tags=metric_tags,
        )

    def timing(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        stacklevel: int = 0,
    ) -> None:
        pass

    def gauge(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        if not self._should_sample(sample_rate):
            return

        metric_tags = dict(tags) if tags else {}
        if instance:
            metric_tags["instance"] = instance

        sentry_sdk.metrics.gauge(
            key=self._get_key(key),
            value=value,
            unit=unit or "none",
            tags=metric_tags,
        )

    def distribution(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        if not self._should_sample(sample_rate):
            return

        metric_tags = dict(tags) if tags else {}
        if instance:
            metric_tags["instance"] = instance

        sentry_sdk.metrics.distribution(
            key=self._get_key(key),
            value=value,
            unit=unit or "none",
            tags=metric_tags,
        )

    def event(
        self,
        title: str,
        message: str,
        alert_type: str | None = None,
        aggregation_key: str | None = None,
        source_type_name: str | None = None,
        priority: str | None = None,
        instance: str | None = None,
        tags: Tags | None = None,
        stacklevel: int = 0,
    ) -> None:
        pass
