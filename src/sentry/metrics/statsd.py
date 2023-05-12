__all__ = ["StatsdMetricsBackend"]

from typing import Any, Optional, Union

import statsd

from .base import MetricsBackend, Tags


class StatsdMetricsBackend(MetricsBackend):
    def __init__(self, host: str = "127.0.0.1", port: int = 8125, **kwargs: Any) -> None:
        self.client = statsd.StatsClient(host=host, port=port)
        super().__init__(**kwargs)

    def _full_key(self, key: str, instance: Optional[str] = None) -> str:
        if instance:
            return f"{key}.{instance}"
        return key

    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
    ) -> None:
        self.client.incr(self._full_key(self._get_key(key)), amount, sample_rate)

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        self.client.timing(self._full_key(self._get_key(key)), value, sample_rate)

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        self.client.gauge(self._full_key(self._get_key(key)), value, sample_rate)
