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
    NamedTuple,
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
MetricTagValueInternal = str
MetricTagsInternal = Tuple[Tuple[MetricTagKey, MetricTagValueInternal], ...]

# External representation of tags as a dictionary.
MetricTagValueExternal = Union[str, List[str], Tuple[str, ...]]
MetricTagsExternal = Mapping[MetricTagKey, MetricTagValueExternal]

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


class BucketKey(NamedTuple):
    """
    Key of the bucket.
    """

    timestamp: int
    metric_type: MetricType
    metric_key: str
    metric_unit: MetricUnit
    metric_tags: MetricTagsInternal


class Metric(Generic[T]):
    @property
    def weight(self) -> int:
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
        self.last = 0.0
        self.min = 0.0
        self.max = 0.0
        self.sum = 0.0
        self.count = 0

    @property
    def weight(self) -> int:
        # Number of elements.
        return 5

    def add(self, value: float) -> None:
        self.last = value
        self.sum += value
        self.count += 1

        # If we didn't have any value, we will initialize the min and max accordingly.
        if self.count == 0.0:
            self.min = value
            self.max = value
        else:
            self.min = min(self.min, value)
            self.max = max(self.max, value)

    def serialize_value(self) -> Any:
        return {
            "last": self.last,
            "min": self.min,
            "max": self.max,
            "sum": self.sum,
            "count": self.count,
        }


class DistributionMetric(Metric[float]):
    __slots__ = ("value",)

    def __init__(self) -> None:
        self.value: List[float] = []

    @property
    def weight(self) -> int:
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
    def weight(self) -> int:
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
    MAX_WEIGHT = 100000

    def __init__(self) -> None:
        self.buckets: Dict[BucketKey, Metric[Any]] = {}
        # Stores the total weight of the in-memory buckets. Weight is determined on a per metric type basis and
        # represents how much weight is there to represent the metric (e.g., counter = 1, distribution = n).
        self._buckets_total_weight: int = 0
        # Lock protecting concurrent access to variables by the flusher and the calling threads that call add or stop.
        self._lock: Lock = Lock()
        # Signals whether the loop of the flusher is running.
        self._running: bool = True
        # Used to maintain synchronization between the flusher and external callers.
        self._flush_event: Event = Event()
        # Use to signal whether we want to flush the buckets in the next loop iteration, irrespectively of the cutoff.
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
            weight_to_remove = 0
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

                extracted_metrics.append((extracted_metric, metric.weight))
                flushed_buckets.add(bucket_key)
                weight_to_remove += metric.weight

            # We remove all flushed buckets, in order to avoid memory leaks.
            for bucket_key in flushed_buckets:
                buckets.pop(bucket_key)

            self._force_flush = False
            self._buckets_total_weight -= weight_to_remove

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

        bucket_key = BucketKey(
            timestamp=int((timestamp // self.ROLLUP_IN_SECONDS) * self.ROLLUP_IN_SECONDS),
            metric_type=ty,
            metric_key=key,
            metric_unit=unit,
            # We have to convert tags into our own internal format, since we don't support lists as
            # tag values.
            metric_tags=self._to_internal_metric_tags(tags),
        )

        with self._lock:
            metric = self.buckets.get(bucket_key)
            if metric is None:
                metric = METRIC_TYPES[ty]()
                self.buckets[bucket_key] = metric

            # We first change the weight by taking the old one and the new one.
            previous_weight = metric.weight
            metric.add(value)
            self._buckets_total_weight += metric.weight - previous_weight
            # Given the new weight we consider whether we want to force flush.
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
        total_weight = len(self.buckets) + self._buckets_total_weight
        if total_weight >= self.MAX_WEIGHT:
            self._force_flush = True
            self._flush_event.set()

    @classmethod
    def _to_internal_metric_tags(cls, tags: Optional[MetricTagsExternal]) -> MetricTagsInternal:
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

    @classmethod
    def _emit(cls, extracted_metrics: List[Tuple[ExtractedMetric, int]], force_flush: bool) -> Any:
        # We obtain the counts for each metric type of how many buckets we have and how much weight is in each
        # bucket.
        stats_by_type: Dict[MetricType, Tuple[int, int]] = {}

        for metric, weight in extracted_metrics:
            metric_type = metric["type"]
            (prev_buckets_count, prev_buckets_weight) = stats_by_type.get(metric_type, (0, 0))
            stats_by_type[metric_type] = (
                prev_buckets_count + 1,
                prev_buckets_weight + weight,
            )

        for metric_type, (buckets_count, buckets_weight) in stats_by_type.items():
            # We want to emit a metric on how many buckets and weight there was for a metric type.
            cls._safe_emit_distribution_metric(
                key="minimetrics.flushed_buckets",
                value=buckets_count,
                tags={"metric_type": metric_type, "force_flush": force_flush},
            )
            cls._safe_emit_distribution_metric(
                key="minimetrics.flushed_buckets_weight",
                value=buckets_weight,
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
        unit: MetricUnit = None,
        tags: Optional[MetricTagsExternal] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        if not self._is_in_minimetrics():
            self.aggregator.add("s", key, value, unit, tags, timestamp)

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
