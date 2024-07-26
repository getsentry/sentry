import random

import sentry_sdk
from sentry_sdk.metrics import metrics_noop

from sentry.metrics.base import MetricsBackend, Tags


@metrics_noop
def _set_metric_on_span(key: str, value: float | int, op: str, tags: Tags | None = None) -> None:
    span_or_tx = sentry_sdk.get_current_span()
    if span_or_tx is None:
        return

    span_or_tx.set_data(key, value)
    if tags:
        for tag_key, tag_value in tags.items():
            span_or_tx.set_tag(tag_key, tag_value)


class MiniMetricsMetricsBackend(MetricsBackend):
    @staticmethod
    def _keep_metric(sample_rate: float) -> bool:
        return random.random() < sample_rate

    @staticmethod
    def _to_minimetrics_unit(unit: str | None, default: str | None = None) -> str:
        if unit is None:
            if default is not None:
                return default

            return "none"

        return unit

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
        if self._keep_metric(sample_rate):
            _set_metric_on_span(key=key, value=amount, op="incr", tags=tags)

    def timing(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        stacklevel: int = 0,
    ) -> None:
        if self._keep_metric(sample_rate):
            _set_metric_on_span(key=key, value=value, op="timing", tags=tags)

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
        if self._keep_metric(sample_rate):
            _set_metric_on_span(key=key, value=value, op="gauge", tags=tags)

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
        if self._keep_metric(sample_rate):
            _set_metric_on_span(key=key, value=value, op="distribution", tags=tags)

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
