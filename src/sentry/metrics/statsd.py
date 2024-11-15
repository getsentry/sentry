__all__ = ["StatsdMetricsBackend"]

from typing import Any

import statsd

from .base import MetricsBackend, Tags


class StatsdMetricsBackend(MetricsBackend):
    def __init__(self, host: str = "127.0.0.1", port: int = 8125, **kwargs: Any) -> None:
        self.client = statsd.StatsClient(host=host, port=port)
        super().__init__(**kwargs)

    def _full_key(self, key: str, instance: str | None = None) -> str:
        if instance:
            return f"{key}.{instance}"
        return key

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
        self.client.incr(self._full_key(self._get_key(key)), amount, sample_rate)

    def timing(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        stacklevel: int = 0,
    ) -> None:
        self.client.timing(self._full_key(self._get_key(key)), value, sample_rate)

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
        self.client.gauge(self._full_key(self._get_key(key)), value, sample_rate)

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
        self.timing(key, value, instance, tags, sample_rate)

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
