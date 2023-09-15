import os
import threading
import time
import zlib
from contextlib import contextmanager
from functools import wraps
from threading import Event, Lock, Thread
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple, Union

import sentry_sdk

from minimetrics.transport import MetricEnvelopeTransport, RelayStatsdEncoder
from minimetrics.types import (
    BucketKey,
    FlushedMetric,
    FlushedMetricValue,
    Metric,
    MetricTagsExternal,
    MetricTagsInternal,
    MetricType,
    MetricUnit,
    MetricValue,
)
from sentry import options
from sentry.utils import metrics

# The thread local instance must be initialized globally in order to correctly use the state.
thread_local = threading.local()


@contextmanager
def enter_minimetrics():
    try:
        old = thread_local.in_minimetrics
    except AttributeError:
        old = False

    thread_local.in_minimetrics = True
    try:
        yield
    finally:
        thread_local.in_minimetrics = old


def is_in_minimetrics():
    try:
        return thread_local.in_minimetrics
    except AttributeError:
        return False


def minimetrics_noop(f):
    @wraps(f)
    def new_function(*args, **kwargs):
        if is_in_minimetrics():
            return None

        with enter_minimetrics():
            return f(*args, **kwargs)

    return new_function


class CounterMetric(Metric[float]):
    __slots__ = ("value",)

    def __init__(self, first: float) -> None:
        self.value = first

    @property
    def weight(self) -> int:
        return 1

    def add(self, value: float) -> None:
        self.value += value

    def serialize_value(self) -> Iterable[FlushedMetricValue]:
        yield self.value


class GaugeMetric(Metric[float]):
    __slots__ = (
        "last",
        "min",
        "max",
        "sum",
        "count",
    )

    def __init__(self, first: float) -> None:
        self.last = first
        self.min = first
        self.max = first
        self.sum = first
        self.count = 1

    @property
    def weight(self) -> int:
        # Number of elements.
        return 5

    def add(self, value: float) -> None:
        self.last = value
        self.min = min(self.min, value)
        self.max = max(self.max, value)
        self.sum += value
        self.count += 1

    def serialize_value(self) -> Iterable[FlushedMetricValue]:
        yield self.last
        yield self.min
        yield self.max
        yield self.sum
        yield self.count


class DistributionMetric(Metric[float]):
    __slots__ = ("value",)

    def __init__(self, first: float) -> None:
        self.value: List[float] = [first]

    @property
    def weight(self) -> int:
        return len(self.value)

    def add(self, value: float) -> None:
        self.value.append(float(value))

    def serialize_value(self) -> Iterable[FlushedMetricValue]:
        return self.value


class SetMetric(Metric[Union[str, int]]):
    __slots__ = ("value",)

    def __init__(self, first: Union[str, int]) -> None:
        self.value: Set[Union[str, int]] = {first}

    @property
    def weight(self) -> int:
        return len(self.value)

    def add(self, value: Union[str, int]) -> None:
        self.value.add(value)

    def serialize_value(self) -> Iterable[FlushedMetricValue]:
        def _hash(x: Any) -> int:
            if isinstance(x, str):
                return zlib.crc32(x.encode("utf-8")) & 0xFFFFFFFF
            return int(x)

        return (_hash(value) for value in self.value)


METRIC_TYPES: Dict[str, Callable[[Any], Metric[Any]]] = {
    "c": CounterMetric,
    "g": GaugeMetric,
    "d": DistributionMetric,
    "s": SetMetric,
}


class Aggregator:
    ROLLUP_IN_SECONDS = 10.0
    MAX_WEIGHT = 100000
    DEFAULT_SAMPLE_RATE = 1.0

    def __init__(self) -> None:
        # Buckets holding the grouped metrics.
        self.buckets: Dict[BucketKey, Metric[Any]] = {}
        # Stores the total weight of the in-memory buckets. Weight is determined on a per metric type basis and
        # represents how much weight is there to represent the metric (e.g., counter = 1, distribution = n).
        self._buckets_total_weight: int = 0
        # Transport layer used to send metrics.
        self._transport: MetricEnvelopeTransport = MetricEnvelopeTransport(RelayStatsdEncoder())
        # Lock protecting concurrent access to variables by the flusher and the calling threads that call add or stop.
        self._lock: Lock = Lock()
        # Signals whether the loop of the flusher is running.
        self._running: bool = True
        # Used to maintain synchronization between the flusher and external callers.
        self._flush_event: Event = Event()
        # Use to signal whether we want to flush the buckets in the next loop iteration, irrespectively of the cutoff.
        self._force_flush: bool = False

        # Thread handling the flushing loop.
        self._flusher: Optional[Thread] = None
        self._flusher_pid: Optional[int] = None
        self._ensure_thread()

    def _ensure_thread(self):
        """For forking processes we might need to restart this thread.
        This ensures that our process actually has that thread running.
        """
        pid = os.getpid()
        if self._flusher_pid == pid:
            return
        with self._lock:
            self._flusher_pid = pid
            self._flusher = Thread(target=self._flush_loop)
            self._flusher.daemon = True
            self._flusher.start()

    def _flush_loop(self) -> None:
        while self._running or self._force_flush:
            self._flush()
            self._flush_event.wait(5.0)

    def _flush(self):
        with enter_minimetrics():
            with self._lock:
                buckets = self.buckets
                force_flush = self._force_flush

                if force_flush:
                    flushed_metrics = buckets.items()
                    self.buckets = {}
                    self._buckets_total_weight = 0
                    self._force_flush = False

                else:
                    cutoff = time.time() - self.ROLLUP_IN_SECONDS
                    weight_to_remove = 0
                    flushed_metrics = []
                    for bucket_key, metric in buckets.items():
                        if bucket_key[0] > cutoff:
                            continue

                        flushed_metrics.append((bucket_key, metric))
                        weight_to_remove += metric.weight

                    # We remove all flushed buckets, in order to avoid memory leaks.
                    for bucket_key, _ in flushed_metrics:
                        buckets.pop(bucket_key)

                    self._buckets_total_weight -= weight_to_remove

            if flushed_metrics:
                # You should emit metrics to `metrics` only inside this method, since we know that if we received
                # metrics the `sentry.utils.metrics` file was initialized. If we do it before, it will likely cause a
                # circular dependency since the methods in the `sentry.utils.metrics` depend on the backend
                # initialization, thus if you emit metrics when a backend is initialized Python will throw an error.
                self._emit(flushed_metrics, force_flush)

    @minimetrics_noop
    def add(
        self,
        ty: MetricType,
        key: str,
        value: MetricValue,
        unit: MetricUnit,
        tags: Optional[MetricTagsExternal],
        timestamp: Optional[float],
    ) -> None:
        self._ensure_thread()

        if self._flusher is None:
            return

        if timestamp is None:
            timestamp = time.time()

        bucket_key = (
            int((timestamp // self.ROLLUP_IN_SECONDS) * self.ROLLUP_IN_SECONDS),
            ty,
            key,
            unit,
            # We have to convert tags into our own internal format, since we don't support lists as
            # tag values.
            self._to_internal_metric_tags(tags),
        )

        with self._lock:
            metric = self.buckets.get(bucket_key)
            if metric is not None:
                previous_weight = metric.weight
                metric.add(value)
            else:
                metric = self.buckets[bucket_key] = METRIC_TYPES[ty](value)
                previous_weight = 0

            self._buckets_total_weight += metric.weight - previous_weight
            # Given the new weight we consider whether we want to force flush.
            self.consider_force_flush()

        # We want to track how many times metrics are being added, so that we know the actual count of adds.
        metrics.incr(
            key="minimetrics.add",
            amount=1,
            tags={"metric_type": ty},
            sample_rate=self.DEFAULT_SAMPLE_RATE,
        )

    def stop(self):
        if self._flusher is None:
            return

        # Firstly we tell the flusher that we want to force flush.
        with self._lock:
            self._force_flush = True
            self._running = False

        # Secondly we notify the flusher to move on and we wait for its completion.
        self._flush_event.set()
        self._flusher.join()
        self._flusher = None

    def consider_force_flush(self):
        # It's important to acquire a lock around this method, since it will touch shared data structures.
        total_weight = len(self.buckets) + self._buckets_total_weight
        if total_weight >= self.MAX_WEIGHT:
            self._force_flush = True
            self._flush_event.set()

    def _emit(self, flushed_metrics: Iterable[FlushedMetric], force_flush: bool) -> Any:
        if options.get("delightful_metrics.enable_envelope_forwarding"):
            try:
                self._transport.send(flushed_metrics)
            except Exception as e:
                sentry_sdk.capture_exception(e)

        # We obtain the counts for each metric type of how many buckets we have and how much weight is in each
        # bucket.
        stats_by_type: Dict[MetricType, Tuple[int, int]] = {}
        for bucket_key, metric in flushed_metrics:
            (prev_buckets_count, prev_buckets_weight) = stats_by_type.get(bucket_key[1], (0, 0))
            stats_by_type[bucket_key[1]] = (
                prev_buckets_count + 1,
                prev_buckets_weight + metric.weight,
            )

        for metric_type, (buckets_count, buckets_weight) in stats_by_type.items():
            # We want to emit a metric on how many buckets and weight there was for a metric type.
            metrics.timing(
                key="minimetrics.flushed_buckets",
                value=buckets_count,
                tags={"metric_type": metric_type, "force_flush": force_flush},
                sample_rate=self.DEFAULT_SAMPLE_RATE,
            )
            metrics.incr(
                key="minimetrics.flushed_buckets_counter",
                amount=buckets_count,
                tags={"metric_type": metric_type, "force_flush": force_flush},
                sample_rate=self.DEFAULT_SAMPLE_RATE,
            )
            metrics.timing(
                key="minimetrics.flushed_buckets_weight",
                value=buckets_weight,
                tags={"metric_type": metric_type, "force_flush": force_flush},
                sample_rate=self.DEFAULT_SAMPLE_RATE,
            )
            metrics.incr(
                key="minimetrics.flushed_buckets_weight_counter",
                amount=buckets_weight,
                tags={"metric_type": metric_type, "force_flush": force_flush},
                sample_rate=self.DEFAULT_SAMPLE_RATE,
            )

    def _to_internal_metric_tags(self, tags: Optional[MetricTagsExternal]) -> MetricTagsInternal:
        rv = []
        for key, value in (tags or {}).items():
            # If the value is a collection, we want to flatten it.
            if isinstance(value, (list, tuple)):
                for inner_value in value:
                    rv.append((key, inner_value))
            else:
                rv.append((key, value))

        # It's very important to sort the tags in order to obtain the same bucket key.
        return tuple(sorted(rv))


class MiniMetricsClient:
    def __init__(self) -> None:
        self.aggregator = Aggregator()

    def incr(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "nanosecond",
        tags: Optional[MetricTagsExternal] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        self.aggregator.add("c", key, value, unit, tags, timestamp)

    def timing(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "second",
        tags: Optional[MetricTagsExternal] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        self.aggregator.add("d", key, value, unit, tags, timestamp)

    def set(
        self,
        key: str,
        value: Union[str, int],
        unit: MetricUnit = "none",
        tags: Optional[MetricTagsExternal] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        self.aggregator.add("s", key, value, unit, tags, timestamp)

    def gauge(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "second",
        tags: Optional[MetricTagsExternal] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        # For now, we emit gauges as counts.
        self.aggregator.add("c", key, value, unit, tags, timestamp)
