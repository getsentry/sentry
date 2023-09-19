import random
from typing import Any, Optional, Union

import sentry_sdk

from minimetrics import MetricTagsExternal, MiniMetricsClient
from sentry.metrics.base import MetricsBackend, Tags


def _to_minimetrics_external_metric_tags(tags: Optional[Tags]) -> Optional[MetricTagsExternal]:
    # We remove all `None` values, since then the types will be compatible.
    casted_tags: Any = None
    if tags is not None:
        casted_tags = {
            tag_key: str(tag_value) for tag_key, tag_value in tags.items() if tag_value is not None
        }

    return casted_tags


# This is needed to pass data between the sdk patcher and the
# minimetrics backend.  This is not super clean but it allows us to
# initialize these things in arbitrary order.
minimetrics_client: Optional[MiniMetricsClient] = None


def patch_sentry_sdk():
    client = sentry_sdk.Hub.main.client
    if client is None:
        return

    old_flush = client.flush

    def new_flush(*args, **kwargs):
        client = minimetrics_client
        if client is not None:
            client.aggregator.consider_force_flush()
        return old_flush(*args, **kwargs)

    client.flush = new_flush  # type:ignore

    old_close = client.close

    def new_close(*args, **kwargs):
        client = minimetrics_client
        if client is not None:
            client.aggregator.stop()
        return old_close(*args, **kwargs)

    client.close = new_close  # type:ignore

    old_data_category = sentry_sdk.envelope.Item.data_category.fget  # type:ignore

    @property  # type:ignore
    def data_category(self):
        if self.headers.get("type") == "statsd":
            return "statsd"
        return old_data_category(self)

    sentry_sdk.envelope.Item.data_category = data_category  # type:ignore


class MiniMetricsMetricsBackend(MetricsBackend):
    def __init__(self, prefix: Optional[str] = None):
        super().__init__(prefix=prefix)
        global minimetrics_client
        self.client = MiniMetricsClient()
        minimetrics_client = self.client

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
