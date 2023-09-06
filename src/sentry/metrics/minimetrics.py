import random
from typing import Optional, Union, cast

import sentry_sdk

from minimetrics import MetricTagsExternal, MiniMetricsClient
from sentry.metrics.base import MetricsBackend, Tags


def _to_minimetrics_external_metric_tags(tags: Optional[Tags]) -> Optional[MetricTagsExternal]:
    # The types are not fully compatible, since `Tags` has also `None` and `MetricTagsExternal` has
    # also `List` but for now we assume they are compatible.
    return cast(Optional[MetricTagsExternal], tags)


class MiniMetricsMetricsBackend(MetricsBackend):
    def __init__(self, prefix: Optional[str] = None):
        super().__init__(prefix=prefix)
        self.client = MiniMetricsClient()

    def _patch_sdk(self):
        client = sentry_sdk.Hub.main.client
        if client is not None:
            old_flush = client.flush

            def new_flush(*args, **kwargs):
                self.client.aggregator.consider_force_flush()
                return old_flush(*args, **kwargs)

            client.flush = new_flush  # type:ignore

            old_close = client.close

            def new_close(*args, **kwargs):
                self.client.aggregator.stop()
                return old_close(*args, **kwargs)

            client.close = new_close  # type:ignore

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
            self.client.incr(
                key=self._get_key(key),
                value=amount,
                tags=_to_minimetrics_external_metric_tags(tags),
            )

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        if self._keep_metric(sample_rate):
            self.client.timing(
                key=self._get_key(key), value=value, tags=_to_minimetrics_external_metric_tags(tags)
            )

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        if self._keep_metric(sample_rate):
            self.client.gauge(
                key=self._get_key(key), value=value, tags=_to_minimetrics_external_metric_tags(tags)
            )
