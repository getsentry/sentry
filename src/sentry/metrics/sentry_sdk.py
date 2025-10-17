from random import random
from typing import Any

from sentry_sdk import _metrics as metrics

from .base import MetricsBackend, Tags

__all__ = ["SentrySDKMetricsBackend"]


class SentrySDKMetricsBackend(MetricsBackend):
    def __init__(self, **kwargs: Any) -> None:
        self._experimental_sample_rate = kwargs.pop("experimental_sample_rate", 0.0)
        self._deny_list = tuple(kwargs.pop("deny_list", []))
        super().__init__(**kwargs)

    def _is_denied(self, key: str) -> bool:
        return key.startswith(self._deny_list)

    def _should_send(self, key: str) -> bool:
        if self._is_denied(key):
            return False
        return self._should_sample_experimental()

    def _should_sample_experimental(self) -> bool:
        """Sample based on passed in sample rate, can't use options as they hit the db too much."""
        return self._experimental_sample_rate >= 1.0 or random() < self._experimental_sample_rate

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
        if not self._should_send(key):
            return

        if not self._should_sample(sample_rate):
            return

        metric_attributes = dict(tags) if tags else {}
        if instance:
            metric_attributes["instance"] = instance

        metrics.count(
            self._get_key(key),
            amount,
            unit=unit,
            attributes=metric_attributes,
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
        if not self._should_send(key):
            return

        if not self._should_sample(sample_rate):
            return

        metric_attributes = dict(tags) if tags else {}
        if instance:
            metric_attributes["instance"] = instance

        metrics.gauge(
            self._get_key(key),
            value,
            unit=unit,
            attributes=metric_attributes,
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
        if not self._should_send(key):
            return

        if not self._should_sample(sample_rate):
            return

        metric_attributes = dict(tags) if tags else {}
        if instance:
            metric_attributes["instance"] = instance

        metrics.distribution(
            self._get_key(key),
            value,
            unit=unit,
            attributes=metric_attributes,
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
