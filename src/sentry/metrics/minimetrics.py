import random
from typing import Optional, Union

from sentry.metrics.base import MetricsBackend, Tags

__all__ = ["MiniMetricsMetricsBackend"]

from sentry.snuba.minimetrics.core import Client


# TODO:
#   * Check how to use units
#   * Check usage of instance
class MiniMetricsMetricsBackend(MetricsBackend):
    def __init__(self, prefix: Optional[str] = None):
        super().__init__(prefix=prefix)
        self._client = Client()

    @staticmethod
    def _keep_metric(sample_rate: float) -> bool:
        return random.random() < sample_rate

    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
    ) -> None:
        if self._keep_metric(sample_rate):
            self._client.incr(key=self._get_key(key), value=amount, tags=tags)

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        if self._keep_metric(sample_rate):
            self._client.timing(key=self._get_key(key), value=value, tags=tags)

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        if self._keep_metric(sample_rate):
            self._client.gauge(key=self._get_key(key), value=value, tags=tags)
