# mypy: ignore-errors

import random
from functools import wraps
from typing import Any, Dict, Iterable, Optional, Tuple, Union

import sentry_sdk

try:
    from sentry_sdk.metrics import Metric, MetricsAggregator, metrics_noop  # type: ignore

    have_minimetrics = True
except ImportError:
    have_minimetrics = False

from sentry import options
from sentry.metrics.base import MetricsBackend, Tags
from sentry.utils import metrics


def patch_sentry_sdk():
    if not have_minimetrics:
        return

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
    def tracked_add(self, ty, *args, **kwargs):
        real_add(self, ty, *args, **kwargs)
        report_tracked_add(ty)

    @wraps(real_emit)
    def patched_emit(self, flushable_buckets: Iterable[Tuple[int, Dict[Any, Metric]]]):
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
            metrics.timing(
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
            metrics.timing(
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
            envelope = real_emit(self, flushable_buckets)
            metrics.timing(
                key="minimetrics.encoded_metrics_size",
                value=len(envelope.items[0].payload.get_bytes()),
                sample_rate=1.0,
            )

    MetricsAggregator.add = tracked_add  # type: ignore
    MetricsAggregator._emit = patched_emit  # type: ignore


def before_emit_metric(key: str, tags: Dict[str, Any]) -> bool:
    if not options.get("delightful_metrics.enable_common_tags"):
        tags.pop("transaction", None)
        tags.pop("release", None)
        tags.pop("environment", None)
    return True


class MiniMetricsMetricsBackend(MetricsBackend):
    def __init__(self, prefix: Optional[str] = None):
        super().__init__(prefix=prefix)
        if not have_minimetrics:
            raise RuntimeError("Sentry SDK too old (no minimetrics)")

    @staticmethod
    def _keep_metric(sample_rate: float) -> bool:
        return random.random() < sample_rate

    @staticmethod
    def _to_minimetrics_unit(unit: Optional[str], default: Optional[str] = None) -> str:
        if unit is None and default is None:
            return "none"
        elif unit is None:
            return default
        else:
            return unit

    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
        unit: Optional[str] = None,
    ) -> None:
        if self._keep_metric(sample_rate):
            sentry_sdk.metrics.incr(
                key=self._get_key(key),
                value=amount,
                tags=tags,
                unit=self._to_minimetrics_unit(unit=unit),
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
            sentry_sdk.metrics.distribution(
                key=self._get_key(key),
                value=value,
                tags=tags,
                # Timing is defaulted to seconds.
                unit="second",
            )

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        unit: Optional[str] = None,
    ) -> None:
        if self._keep_metric(sample_rate):
            # XXX: make this into a gauge later
            sentry_sdk.metrics.incr(
                key=self._get_key(key),
                value=value,
                tags=tags,
                unit=self._to_minimetrics_unit(unit=unit),
            )

    def distribution(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        unit: Optional[str] = None,
    ) -> None:
        if self._keep_metric(sample_rate):
            sentry_sdk.metrics.distribution(
                key=self._get_key(key),
                value=value,
                tags=tags,
                unit=self._to_minimetrics_unit(unit=unit),
            )
