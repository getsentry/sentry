import random
from datetime import datetime, timedelta, timezone

import sentry_sdk
from sentry_sdk.metrics import metrics_noop
from sentry_sdk.tracing import Span

from sentry.metrics.base import MetricsBackend, Tags


def _attach_tags(span: Span, tags: Tags | None) -> None:
    if tags:
        for tag_key, tag_value in tags.items():
            span.set_data(tag_key, tag_value)


@metrics_noop
def _set_metric_on_span(key: str, value: float | int, op: str, tags: Tags | None = None) -> None:
    span_or_tx = sentry_sdk.get_current_span()
    if span_or_tx is None:
        return

    span_or_tx.set_data(key, value)
    _attach_tags(span_or_tx, tags)


class MiniMetricsMetricsBackend(MetricsBackend):
    @staticmethod
    def _keep_metric(sample_rate: float) -> bool:
        return random.random() < sample_rate

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
            span_or_tx = sentry_sdk.get_current_span()
            if span_or_tx is None:
                return

            if span_or_tx.op == key:
                _attach_tags(span_or_tx, tags)
                return

            timestamp = datetime.now(timezone.utc)
            start_timestamp = timestamp - timedelta(seconds=value)
            span = span_or_tx.start_child(op=key, start_timestamp=start_timestamp)
            _attach_tags(span, tags)
            span.finish(end_timestamp=timestamp)

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
