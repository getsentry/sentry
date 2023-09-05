import random
import threading
import time
import zlib
from threading import Event, Lock, Thread
from typing import (
    Any,
    Callable,
    Dict,
    Generic,
    List,
    Literal,
    Mapping,
    Optional,
    Set,
    Tuple,
    TypeVar,
    Union,
)

import sentry_sdk

from sentry.metrics.base import MetricsBackend, Tags
from sentry.utils import metrics

__all__ = ["MiniMetricsMetricsBackend"]

# The thread local instance must be initialized globally in order to correctly use the state.
thread_local = threading.local()


T = TypeVar("T")


MetricUnit = Literal[
    None,
    "nanosecond",
    "microsecond",
    "millisecond",
    "second",
    "minute",
    "hour",
    "day",
    "week",
    "bit",
    "byte",
    "kilobyte",
    "kibibyte",
    "mebibyte",
    "gigabyte",
    "terabyte",
    "tebibyte",
    "petabyte",
    "pebibyte",
    "exabyte",
    "exbibyte",
    "ratio",
    "percent",
]


def _flatten_tags(tags: Optional[Mapping[str, Any]]) -> Tuple[Tuple[str, str], ...]:
    rv = []
    for key, value in (tags or {}).items():
        if isinstance(value, (list, tuple)):
            for inner_value in value:
                rv.append((key, inner_value))
        else:
            rv.append((key, value))

    return tuple(sorted(rv))


class Metric(Generic[T]):
    @property
    def current_complexity(self) -> int:
        return 1

    def add(self, value: T) -> None:
        raise NotImplementedError()

    def serialize_value(self) -> Any:
        raise NotImplementedError()


class CounterMetric(Metric[float]):
    __slots__ = ("value",)

    def __init__(self) -> None:
        self.value = 0.0

    def add(self, value: float) -> None:
        self.value += value

    def serialize_value(self) -> Any:
        return self.value


class GaugeMetric(Metric[float]):
    __slots__ = ("min", "max", "sum", "count", "last")

    def __init__(self) -> None:
        self.min = float("inf")
        self.max = float("-inf")
        self.sum = 0.0
        self.count = 0.0
        self.last = float("nan")

    def add(self, value: float) -> None:
        self.min = min(self.min, value)
        self.max = max(self.max, value)
        self.last = value
        self.count += 1
        self.sum += value

    def serialize_value(self) -> Any:
        return {
            "min": self.min,
            "max": self.max,
            "last": self.last,
            "sum": self.sum,
            "count": self.count,
        }


class DistributionMetric(Metric[float]):
    __slots__ = ("value",)

    def __init__(self) -> None:
        self.value: List[float] = []

    @property
    def current_complexity(self) -> int:
        return len(self.value)

    def add(self, value: float) -> None:
        self.value.append(value)

    def serialize_value(self) -> Any:
        return self.value


class SetMetric(Metric[Union[str, int]]):
    __slots__ = ("value",)

    def __init__(self) -> None:
        self.value: Set[Union[str, int]] = set()

    @property
    def current_complexity(self) -> int:
        return len(self.value)

    def add(self, value: Union[str, int]) -> None:
        self.value.add(value)

    def serialize_value(self) -> Any:
        def _hash(x: Any) -> int:
            if isinstance(x, str):
                return zlib.crc32(x.encode("utf-8")) & 0xFFFFFFFF
            return int(x)

        return [_hash(x) for x in self.value]


METRIC_TYPES: Dict[str, Callable[[], Metric[Any]]] = {
    "c": CounterMetric,
    "g": GaugeMetric,
    "d": DistributionMetric,
    "s": SetMetric,
}

ComposedKey = Tuple[int, str, str, MetricUnit, Tuple[Tuple[str, str], ...]]


class Aggregator:
    ROLLUP_IN_SECONDS = 10.0
    MAX_COMPLEXITY = 100000

    def __init__(self) -> None:
        self.buckets: Dict[ComposedKey, Metric[Any]] = {}
        self._bucket_complexity = 0
        self._lock = Lock()
        self._running = True
        self._flush_event = Event()
        self._force_flush = False
        # Thread handling the flushing loop.
        self._flusher = Thread(target=self._flush_loop)
        self._flusher.daemon = True
        self._flusher.start()

    def _flush_loop(self) -> None:
        # We check without locking these variables, such racy check can lead to problems if we are not careful. The most
        # important invariant of the system that needs to be maintained is that if running and force_flush are false,
        # the number of buckets is equal to 0.
        while self._running or self._force_flush:
            self._flush()
            self._flush_event.wait(2.0)

    def _flush(self):
        with self._lock:
            cutoff = time.time() - self.ROLLUP_IN_SECONDS
            complexity_to_remove = 0
            buckets = self.buckets
            force_flush = self._force_flush
            flushed_buckets = set()
            extracted_metrics = []

            for bucket_key, metric in buckets.items():
                ts, ty, name, unit, tags = bucket_key
                if not force_flush and ts > cutoff:
                    continue

                extracted_metric = {
                    "timestamp": ts,
                    "width": int(self.ROLLUP_IN_SECONDS),
                    "name": name,
                    "type": ty,
                    "value": metric.serialize_value(),
                }
                if unit:
                    extracted_metric["unit"] = unit
                if tags:
                    # We need to be careful here, since we have a list of tuples where the first element of tuples
                    # can be duplicated, thus converting to a dict will end up compressing and losing data.
                    extracted_metric["tags"] = tags

                extracted_metrics.append((extracted_metric, metric.current_complexity))
                flushed_buckets.add(bucket_key)
                complexity_to_remove += metric.current_complexity

            # We remove all flushed buckets, in order to avoid memory leaks.
            for bucket_key in flushed_buckets:
                buckets.pop(bucket_key)

            self._force_flush = False
            self._bucket_complexity -= complexity_to_remove

        if extracted_metrics:
            self._emit(extracted_metrics, force_flush)

    def kill(self):
        # Firstly we tell the flusher that we want to force flush.
        with self._lock:
            self._force_flush = True
            self._running = False

        # Secondly we notify the flusher to move on and we wait for its completion.
        self._flush_event.set()
        self._flusher.join()

    def consider_force_flush(self):
        total_complexity = len(self.buckets) + self._bucket_complexity
        if total_complexity >= self.MAX_COMPLEXITY:
            self._force_flush = True
            self._flush_event.set()

    @classmethod
    def _emit(cls, extracted_metrics: List[Tuple[Any, int]], force_flush: bool) -> Any:
        # We obtain the counts for each metric type of how many buckets we have and how much complexity is in each
        # bucket.
        complexities_by_type: Dict[str, Tuple[int, int]] = {}
        # We obtain the counts for each metric type, since we want to know how many by type we have.
        counts_by_type: Dict[str, float] = {}
        for metric, metric_complexity in extracted_metrics:
            metric_type = metric["type"]
            metric_value = metric["value"]

            value: float = 0.0
            if metric_type == "c":
                # For counters, we want to sum the count value.
                value = metric_value
            elif metric_type == "d":
                # For distributions, we want to track the size of the distribution.
                value = len(metric_value)
            elif metric_type == "g":
                # For gauges, we will emit a count of 1.
                value = metric_value.get("count", 1)
            elif metric_type == "s":
                # For sets, we want to track the cardinality of the set.
                value = len(metric_value)

            counts_by_type[metric_type] = counts_by_type.get(metric_type, 0) + value

            (prev_buckets_count, prev_buckets_complexity) = complexities_by_type.get(
                metric_type, (0, 0)
            )
            complexities_by_type[metric_type] = (
                prev_buckets_count + 1,
                prev_buckets_complexity + metric_complexity,
            )

        # For each type and count we want to emit a metric.
        for metric_type, metric_count in counts_by_type.items():
            # We want to emit a metric on how many metrics we would technically emit if we were to use minimetrics.
            cls._safe_emit_count_metric(
                key="minimetrics.emit",
                amount=int(metric_count),
                tags={"metric_type": metric_type, "force_flush": force_flush},
            )

        for metric_type, (buckets_count, buckets_complexity) in complexities_by_type.items():
            # We want to emit a metric on how many buckets and complexity there was for a metric type.
            cls._safe_emit_count_metric(
                key="minimetrics.flushed_buckets_count",
                amount=buckets_count,
                tags={"metric_type": metric_type, "force_flush": force_flush},
            )
            cls._safe_emit_count_metric(
                key="minimetrics.flushed_buckets_complexity",
                amount=buckets_complexity,
                tags={"metric_type": metric_type, "force_flush": force_flush},
            )

    @classmethod
    def _safe_emit_count_metric(cls, key: str, amount: int, tags: Optional[Tags] = None):
        cls._safe_run(lambda: metrics.incr(key, amount=amount, tags=tags))

    @classmethod
    def _safe_emit_distribution_metric(cls, key: str, value: int, tags: Optional[Tags] = None):
        cls._safe_run(lambda: metrics.timing(key, value=value, tags=tags))

    @classmethod
    def _safe_run(cls, block: Callable[[], None]):
        # In order to avoid an infinite recursion for metrics, we want to use a thread local variable that will
        # signal the downstream calls to only propagate the metric to the primary backend, otherwise if propagated to
        # minimetrics, it will cause unbounded recursion.
        thread_local.in_minimetrics = True
        block()
        thread_local.in_minimetrics = False

    def add(
        self,
        ty: str,
        key: str,
        value: Any,
        unit: MetricUnit,
        tags: Optional[Tags],
        timestamp: Optional[float],
    ) -> None:
        if timestamp is None:
            timestamp = time.time()

        bucket_key: ComposedKey = (
            int((timestamp // self.ROLLUP_IN_SECONDS) * self.ROLLUP_IN_SECONDS),
            ty,
            key,
            unit,
            _flatten_tags(tags),
        )

        with self._lock:
            metric = self.buckets.get(bucket_key)
            if metric is None:
                metric = METRIC_TYPES[ty]()
                self.buckets[bucket_key] = metric

            # We first change the complexity by taking the old one and the new one.
            previous_complexity = metric.current_complexity
            metric.add(value)
            self._bucket_complexity += metric.current_complexity - previous_complexity
            # Given the new complexity we consider whether we want to force flush.
            self.consider_force_flush()


class Client:
    def __init__(self) -> None:
        self.aggregator = Aggregator()

    @staticmethod
    def _is_in_minimetrics():
        try:
            return thread_local.in_minimetrics
        except AttributeError:
            return False

    def incr(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "nanosecond",
        tags: Optional[Tags] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        if not self._is_in_minimetrics():
            self.aggregator.add("c", key, value, unit, tags, timestamp)

    def timing(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "second",
        tags: Optional[Tags] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        if not self._is_in_minimetrics():
            self.aggregator.add("d", key, value, unit, tags, timestamp)

    def set(
        self,
        key: str,
        value: Union[str, int],
        tags: Optional[Tags] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        if not self._is_in_minimetrics():
            self.aggregator.add("s", key, value, None, tags, timestamp)

    def gauge(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "second",
        tags: Optional[Tags] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        if not self._is_in_minimetrics():
            self.aggregator.add("g", key, value, unit, tags, timestamp)


# TODO:
#   * Check how to use units
#   * Check usage of instance
class MiniMetricsMetricsBackend(MetricsBackend):
    def __init__(self, prefix: Optional[str] = None):
        super().__init__(prefix=prefix)
        self.client = Client()

    def _patch_sdk(self):
        client = sentry_sdk.Hub.main.client
        if client is not None:
            old_flush = client.flush

            def new_flush(*args, **kwargs):
                self.client.aggregator.consider_force_flush()
                return old_flush(*args, **kwargs)

            client.flush = new_flush

            old_close = client.close

            def new_close(*args, **kwargs):
                self.client.aggregator.kill()
                return old_close(*args, **kwargs)

            client.close = new_close

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
            self.client.incr(key=self._get_key(key), value=amount, tags=tags)

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        if self._keep_metric(sample_rate):
            self.client.timing(key=self._get_key(key), value=value, tags=tags)

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        if self._keep_metric(sample_rate):
            self.client.gauge(key=self._get_key(key), value=value, tags=tags)
