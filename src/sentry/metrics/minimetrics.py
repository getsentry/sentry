import random
from collections.abc import Iterable
from functools import wraps
from typing import Any

import sentry_sdk
from sentry_sdk.metrics import Metric, MetricsAggregator, metrics_noop
from sentry_sdk.tracing import Span

from sentry import options
from sentry.features.rollout import in_random_rollout
from sentry.metrics.base import MetricsBackend, Tags
from sentry.utils import metrics


def patch_sentry_sdk():
    real_add = MetricsAggregator.add
    real_emit = MetricsAggregator._emit

    @metrics_noop
    def report_tracked_add(ty):
        metrics.incr(
            key="minimetrics.add",
            amount=1,
            tags={"metric_type": ty},
            sample_rate=1.0,
        )

    @wraps(real_add)
    def tracked_add(
        self,
        ty,
        key,
        value,
        unit,
        tags,
        timestamp=None,
        local_aggregator=None,
        stacklevel=0,
    ):
        self._enable_code_locations = options.get("delightful_metrics.enable_code_locations")
        real_add(self, ty, key, value, unit, tags, timestamp, local_aggregator, stacklevel + 1)
        report_tracked_add(ty)

    @wraps(real_emit)
    def patched_emit(
        self, flushable_buckets: Iterable[tuple[int, dict[Any, Metric]]], code_locations: Any
    ):
        if not flushable_buckets and not code_locations:
            return

        flushable_metrics = []
        stats_by_type: Any = {}
        for buckets_timestamp, buckets in flushable_buckets:
            for bucket_key, metric in buckets.items():
                flushable_metric = (buckets_timestamp, bucket_key, metric)
                flushable_metrics.append(flushable_metric)
                (prev_buckets_count, prev_buckets_weight) = stats_by_type.get(bucket_key[0], (0, 0))
                stats_by_type[bucket_key[0]] = (
                    prev_buckets_count + 1,
                    prev_buckets_weight + metric.weight,
                )

        for metric_type, (buckets_count, buckets_weight) in stats_by_type.items():
            metrics.distribution(
                key="minimetrics.flushed_buckets",
                value=buckets_count,
                tags={"metric_type": metric_type},
                sample_rate=1.0,
            )
            metrics.incr(
                key="minimetrics.flushed_buckets_counter",
                amount=buckets_count,
                tags={"metric_type": metric_type},
                sample_rate=1.0,
            )
            metrics.distribution(
                key="minimetrics.flushed_buckets_weight",
                value=buckets_weight,
                tags={"metric_type": metric_type},
                sample_rate=1.0,
            )
            metrics.incr(
                key="minimetrics.flushed_buckets_weight_counter",
                amount=buckets_weight,
                tags={"metric_type": metric_type},
                sample_rate=1.0,
            )

        if options.get("delightful_metrics.enable_capture_envelope"):
            envelope = real_emit(self, flushable_buckets, code_locations)
            if envelope is not None:
                metrics.distribution(
                    key="minimetrics.encoded_metrics_size",
                    value=len(envelope.items[0].payload.get_bytes()),
                    sample_rate=1.0,
                    unit="byte",
                )

    MetricsAggregator.add = tracked_add  # type: ignore[method-assign]
    MetricsAggregator._emit = patched_emit  # type: ignore[method-assign]


def before_emit_metric(key: str, value: int | float | str, unit: str, tags: dict[str, Any]) -> bool:
    if not options.get("delightful_metrics.enable_common_tags"):
        tags.pop("transaction", None)
        tags.pop("release", None)
        tags.pop("environment", None)
    return True


def should_summarize_metric(key: str, tags: dict[str, Any]) -> bool:
    return in_random_rollout("delightful_metrics.metrics_summary_sample_rate")


@metrics_noop
def _set_metric_on_span(key: str, value: float | int, op: str, tags: Tags | None = None) -> None:
    if not options.get("delightful_metrics.enable_span_attributes"):
        return

    scope = sentry_sdk.Scope.get_current_scope()

    span_or_tx = getattr(scope, "_span", None)

    if not span_or_tx:
        with scope.start_transaction(op=f"minimetrics.{op}"):
            with scope.start_span(op=f"minimetrics.{op}") as span:
                return _add_metric_data_to_span(span, key, value, tags)
    elif span_or_tx.parent_span_id is not None:
        return _add_metric_data_to_span(span_or_tx, key, value, tags)
    else:
        with scope.start_span(op=f"minimetrics.{op}") as span:
            return _add_metric_data_to_span(span, key, value, tags)


def _add_metric_data_to_span(
    span: Span, key: str, value: float | int, tags: Tags | None = None
) -> None:
    span.set_data(key, value)
    if tags:
        for tag_key, tag_value in tags.items():
            span.set_tag(tag_key, tag_value)


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
            sentry_sdk.metrics.incr(
                key=self._get_key(key),
                value=amount,
                tags=tags,
                unit=self._to_minimetrics_unit(unit=unit),
                stacklevel=stacklevel + 1,
            )

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
            sentry_sdk.metrics.distribution(
                key=self._get_key(key),
                value=value,
                tags=tags,
                # Timing is defaulted to seconds.
                unit="second",
                stacklevel=stacklevel + 1,
            )

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
            if options.get("delightful_metrics.emit_gauges"):
                sentry_sdk.metrics.gauge(
                    key=self._get_key(key),
                    value=value,
                    tags=tags,
                    unit=self._to_minimetrics_unit(unit=unit),
                    stacklevel=stacklevel + 1,
                )
            else:
                sentry_sdk.metrics.incr(
                    key=self._get_key(key),
                    value=value,
                    tags=tags,
                    unit=self._to_minimetrics_unit(unit=unit),
                    stacklevel=stacklevel + 1,
                )

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
            sentry_sdk.metrics.distribution(
                key=self._get_key(key),
                value=value,
                tags=tags,
                unit=self._to_minimetrics_unit(unit=unit),
                stacklevel=stacklevel + 1,
            )

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
