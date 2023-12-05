import random
from functools import wraps
from typing import Any, Dict, Iterable, Optional, Tuple, Union

import sentry_sdk
from sentry_sdk.metrics import Metric, MetricsAggregator, metrics_noop

from sentry import options
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
        self, flushable_buckets: Iterable[Tuple[int, Dict[Any, Metric]]], code_locations: Any
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

    MetricsAggregator.add = tracked_add  # type: ignore
    MetricsAggregator._emit = patched_emit  # type: ignore


def before_emit_metric(key: str, tags: Dict[str, Any]) -> bool:
    if not options.get("delightful_metrics.enable_common_tags"):
        tags.pop("transaction", None)
        tags.pop("release", None)
        tags.pop("environment", None)
    return True


def should_summarize_metric(key: str, tags: Dict[str, Any]) -> bool:
    return random.random() < options.get("delightful_metrics.metrics_summary_sample_rate")


class MiniMetricsMetricsBackend(MetricsBackend):
    @staticmethod
    def _keep_metric(sample_rate: float) -> bool:
        return random.random() < sample_rate

    @staticmethod
    def _to_minimetrics_unit(unit: Optional[str], default: Optional[str] = None) -> str:
        if unit is None:
            if default is not None:
                return default

            return "none"

        return unit

    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
        unit: Optional[str] = None,
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

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
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

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        unit: Optional[str] = None,
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

    def distribution(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        unit: Optional[str] = None,
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
