import threading
import time
import zlib
from threading import Lock, Thread
from typing import Any, Callable, Dict, Generic, List, Literal, Optional, Set, Tuple, TypeVar, Union

from sentry.metrics.base import MetricsBackend

Tags = Dict[str, str]
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


class Metric(Generic[T]):
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

    def add(self, value: float) -> None:
        self.value.append(value)

    def serialize_value(self) -> Any:
        return self.value


class SetMetric(Metric[Union[str, int]]):
    __slots__ = ("value",)

    def __init__(self) -> None:
        self.value: Set[Union[str, int]] = set()

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

    def __init__(self) -> None:
        self.buckets: Dict[ComposedKey, Metric[Any]] = {}
        self._lock = Lock()
        self._running = True
        self._flusher = Thread(target=self._flush)
        self._flusher.daemon = True
        self._flusher.start()

    def _flush(self) -> None:
        while self._running:
            cutoff = time.time() - self.ROLLUP_IN_SECONDS
            cleanup = set()
            metrics = []
            buckets = self.buckets

            with self._lock:
                for bucket_key, metric in buckets.items():
                    ts, ty, name, unit, tags = bucket_key
                    if ts > cutoff:
                        continue

                    m = {
                        "timestamp": ts,
                        "width": int(self.ROLLUP_IN_SECONDS),
                        "name": name,
                        "type": ty,
                        "value": metric.serialize_value(),
                    }
                    if unit:
                        m["unit"] = unit
                    if tags:
                        m["tags"] = dict(tags)

                    metrics.append(m)
                    cleanup.add(bucket_key)

                for key in cleanup:
                    buckets.pop(key)

            if metrics:
                self._emit(metrics)

            time.sleep(2.0)

    def _emit(self, metrics: Any) -> Any:
        # In order to avoid an infinite recursion for metrics, we want to use a thread local variable that will signal
        # the downstream calls to only propagate the metric to DataDog, otherwise if propagated to minimetrics, it will
        # cause unbounded recursion.
        thread_local = threading.local()
        thread_local.in_minimetrics = True
        # We want to emit a metric on how many metrics we would technically emit if we were to use minimetrics.
        metrics.incr("minimetrics.emit", amount=len(metrics))
        # We clear the thread local variables, in order to make metrics extraction continue as normal.
        thread_local.__dict__.clear()

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

        bucket_key = (
            int((timestamp // self.ROLLUP_IN_SECONDS) * self.ROLLUP_IN_SECONDS),
            ty,
            key,
            unit,
            tuple(sorted(tuple((tags or {}).items()))),
        )

        with self._lock:
            metric = self.buckets.get(bucket_key)
            if metric is None:
                metric = METRIC_TYPES[ty]()
                self.buckets[bucket_key] = metric
            metric.add(value)


class Client:
    def __init__(self) -> None:
        self.aggregator = Aggregator()

    @staticmethod
    def _is_in_minimetrics():
        try:
            thread_local = threading.local()
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
#
class MiniMetricsMetricsBackend(MetricsBackend):
    def __init__(self):
        super().__init__()
        self._client = Client()

    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
    ) -> None:
        self._client.incr(key=key, value=amount, tags=tags)

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        self._client.timing(key=key, value=value, tags=tags)

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        self._client.gauge(key=key, value=value, tags=tags)
