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
    TypedDict,
    TypeVar,
    Union,
)

from typing_extensions import NotRequired

from sentry.utils import metrics

# The thread local instance must be initialized globally in order to correctly use the state.
thread_local = threading.local()


T = TypeVar("T")

# Unit of the metrics.
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
# Type of the metric.
MetricType = Literal["d", "s", "g", "c"]
# Value of the metric.
MetricValue = Union[int, float, str]
# Tag key of a metric.
MetricTagKey = str

# Internal representation of tags as a tuple of tuples (this is done in order to allow for the same key to exist
# multiple times).
MetricTagValueInternal = Union[str, int, float]
MetricTagsInternal = Tuple[Tuple[MetricTagKey, MetricTagValueInternal], ...]

# External representation of tags as a dictionary.
MetricTagValueExternal = Union[str, int, float, List[Union[str, int, float]]]
MetricTagsExternal = Mapping[MetricTagKey, MetricTagValueExternal]

# Key of the bucket.
ComposedKey = Tuple[int, MetricType, str, MetricUnit, MetricTagsInternal]

# Value of a metric that was extracted after bucketing.
ExtractedMetricValue = Union[int, float, List[Union[int, float]]]


class ExtractedMetric(TypedDict):
    """
    Metric extracted from a bucket.
    """

    type: MetricType
    name: str
    value: ExtractedMetricValue
    timestamp: int
    width: int
    unit: NotRequired[MetricUnit]
    tags: NotRequired[MetricTagsInternal]


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
        # For now, we compress gauges with the last value.
        return self.last


class DistributionMetric(Metric[float]):
    __slots__ = ("value",)

    def __init__(self) -> None:
        self.value: List[float] = []

    @property
    def current_complexity(self) -> int:
        return len(self.value)

    def add(self, value: float) -> None:
        self.value.append(float(value))

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


class Aggregator:
    ROLLUP_IN_SECONDS = 10.0
    MAX_COMPLEXITY = 100000

    def __init__(self) -> None:
        self.buckets: Dict[ComposedKey, Metric[Any]] = {}
        self._bucket_complexity: int = 0
        self._lock: Lock = Lock()
        self._running: bool = True
        self._flush_event: Event = Event()
        self._force_flush: bool = False
        # Thread handling the flushing loop.
        self._flusher: Optional[Thread] = Thread(target=self._flush_loop)
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

                extracted_metric: ExtractedMetric = {
                    "type": ty,
                    "name": name,
                    "value": metric.serialize_value(),
                    "timestamp": ts,
                    "width": int(self.ROLLUP_IN_SECONDS),
                }
                if unit:
                    extracted_metric["unit"] = unit
                if tags:
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

    def add(
        self,
        ty: MetricType,
        key: str,
        value: MetricValue,
        unit: MetricUnit,
        tags: Optional[MetricTagsExternal],
        timestamp: Optional[float],
    ) -> None:
        if self._flusher is None:
            return

        if timestamp is None:
            timestamp = time.time()

        bucket_key: ComposedKey = (
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
            if metric is None:
                metric = METRIC_TYPES[ty]()
                self.buckets[bucket_key] = metric

            # We first change the complexity by taking the old one and the new one.
            previous_complexity = metric.current_complexity
            metric.add(value)
            self._bucket_complexity += metric.current_complexity - previous_complexity
            # Given the new complexity we consider whether we want to force flush.
            self.consider_force_flush()

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
        total_complexity = len(self.buckets) + self._bucket_complexity
        if total_complexity >= self.MAX_COMPLEXITY:
            self._force_flush = True
            self._flush_event.set()

    @classmethod
    def _to_internal_metric_tags(cls, tags: Optional[MetricTagsExternal]) -> MetricTagsInternal:
        rv = []
        for key, value in (tags or {}).items():
            if isinstance(value, (list, tuple)):
                for inner_value in value:
                    rv.append((key, inner_value))
            else:
                rv.append((key, value))

        # It's very important to sort the tags in order to obtain the same bucket key.
        return tuple(sorted(rv))

    @classmethod
    def _emit(cls, extracted_metrics: List[Tuple[ExtractedMetric, int]], force_flush: bool) -> Any:
        # We obtain the counts for each metric type of how many buckets we have and how much complexity is in each
        # bucket.
        complexities_by_type: Dict[MetricType, Tuple[int, int]] = {}

        for metric, metric_complexity in extracted_metrics:
            metric_type = metric["type"]
            (prev_buckets_count, prev_buckets_complexity) = complexities_by_type.get(
                metric_type, (0, 0)
            )
            complexities_by_type[metric_type] = (
                prev_buckets_count + 1,
                prev_buckets_complexity + metric_complexity,
            )

        for metric_type, (buckets_count, buckets_complexity) in complexities_by_type.items():
            # We want to emit a metric on how many buckets and complexity there was for a metric type.
            cls._safe_emit_distribution_metric(
                key="minimetrics.flushed_buckets",
                value=buckets_count,
                tags={"metric_type": metric_type, "force_flush": force_flush},
            )
            cls._safe_emit_distribution_metric(
                key="minimetrics.flushed_buckets_complexity",
                value=buckets_complexity,
                tags={"metric_type": metric_type, "force_flush": force_flush},
            )

    @classmethod
    def _safe_emit_count_metric(cls, key: str, amount: int, tags: Optional[Dict[str, Any]] = None):
        cls._safe_run(lambda: metrics.incr(key, amount=amount, tags=tags))

    @classmethod
    def _safe_emit_distribution_metric(
        cls, key: str, value: int, tags: Optional[Dict[str, Any]] = None
    ):
        cls._safe_run(lambda: metrics.timing(key, value=value, tags=tags))

    @classmethod
    def _safe_run(cls, block: Callable[[], None]):
        # In order to avoid an infinite recursion for metrics, we want to use a thread local variable that will
        # signal the downstream calls to only propagate the metric to the primary backend, otherwise if propagated to
        # minimetrics, it will cause unbounded recursion.
        thread_local.in_minimetrics = True
        block()
        thread_local.in_minimetrics = False


class MiniMetricsClient:
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
        tags: Optional[MetricTagsExternal] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        if not self._is_in_minimetrics():
            self.aggregator.add("c", key, value, unit, tags, timestamp)

    def timing(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "second",
        tags: Optional[MetricTagsExternal] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        if not self._is_in_minimetrics():
            self.aggregator.add("d", key, value, unit, tags, timestamp)

    def set(
        self,
        key: str,
        value: Union[str, int],
        tags: Optional[MetricTagsExternal] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        if not self._is_in_minimetrics():
            self.aggregator.add("s", key, value, None, tags, timestamp)

    def gauge(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "second",
        tags: Optional[MetricTagsExternal] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        if not self._is_in_minimetrics():
            self.aggregator.add("g", key, value, unit, tags, timestamp)
