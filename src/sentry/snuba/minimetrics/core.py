import time
import zlib
from threading import Lock, Thread
from typing import (
    Any,
    Callable,
    Dict,
    Generic,
    List,
    Literal,
    Optional,
    Set,
    Tuple,
    TypedDict,
    TypeVar,
    Union,
    cast,
)

import sentry_sdk.transport as sdk_transport
from django.conf import settings

from sentry.metrics.base import Tags

T = TypeVar("T")
MetricType = Literal["d", "s", "g", "c"]
MetricValue = Union[int, float, List[float]]
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
ComposedKey = Tuple[int, MetricType, str, MetricUnit, Tuple[Tuple[str, str], ...]]


class ExtractedMetric(TypedDict):
    type: MetricType
    name: str
    value: MetricValue
    timestamp: int
    width: int
    unit: Optional[MetricUnit]
    tags: Optional[Tags]


class DogStatsDEncoder:
    def __init__(
        self,
        metric_name: str,
        metric_value: MetricValue,
        metric_type: MetricType,
        sample_rate: float,
        tags: Optional[Tags],
    ):
        self._metric_name = metric_name
        # TODO: check how to support gauge and set.
        self._metric_value = metric_value
        self._metric_type = metric_type
        self._sample_rate = sample_rate
        self._tags = tags

    def encode(self) -> str:
        return f"{self._metric_name}:{self._get_metric_value()}|{self._metric_type}{self._get_sample_rate()}{self._get_tags()}"

    def _get_metric_value(self) -> str:
        if isinstance(self._metric_value, float) or isinstance(self._metric_value, int):
            return str(self._metric_value)
        elif isinstance(self._metric_value, List):
            return ":".join([str(value) for value in self._metric_value])

        raise Exception("The metric value must be either a float or a list of floats")

    def _get_sample_rate(self) -> str:
        return f"|@{self._sample_rate}"

    def _get_tags(self) -> str:
        if not self._tags:
            return ""

        tags = ",".join([f"{tag_key}:{tag_value}" for tag_key, tag_value in self._tags.items()])
        return f"|#{tags}"


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


METRIC_TYPES: Dict[MetricType, Callable[[], Metric[Any]]] = {
    "c": CounterMetric,
    "g": GaugeMetric,
    "d": DistributionMetric,
    "s": SetMetric,
}


class Aggregator:
    ROLLUP_IN_SECONDS = 10.0

    def __init__(self) -> None:
        self.buckets: Dict[ComposedKey, Metric[Any]] = {}
        self._prepare_transport()
        self._lock = Lock()
        self._running = True
        self._flusher = Thread(target=self._flush)
        self._flusher.daemon = True
        self._flusher.start()

    def _prepare_transport(self):
        sdk_options = dict(settings.SENTRY_SDK_CONFIG)
        self._transport = sdk_transport.HttpTransport({"dsn": sdk_options.pop("dsn", None)})

    def _flush(self) -> None:
        while self._running:
            cutoff = time.time() - self.ROLLUP_IN_SECONDS
            cleanup = set()
            extracted_metrics = []
            buckets = self.buckets

            with self._lock:
                for bucket_key, metric in buckets.items():
                    ts, ty, name, unit, tags = bucket_key
                    if ts > cutoff:
                        continue

                    extracted_metric: ExtractedMetric = {
                        "type": ty,
                        "name": name,
                        "value": metric.serialize_value(),
                        "timestamp": ts,
                        "width": int(self.ROLLUP_IN_SECONDS),
                        "unit": None,
                        "tags": None,
                    }
                    if unit:
                        extracted_metric["unit"] = unit
                    if tags:
                        extracted_metric["tags"] = dict(tags)

                    extracted_metrics.append(extracted_metric)
                    cleanup.add(bucket_key)

                for key in cleanup:
                    buckets.pop(key)

            if extracted_metrics:
                self._emit(extracted_metrics)

            time.sleep(2.0)

    def _emit(self, extracted_metrics: Any) -> Any:
        for extracted_metric in extracted_metrics:
            payload = DogStatsDEncoder(
                metric_name="",
                metric_value=extracted_metric["value"],
                metric_type=extracted_metric["type"],
                sample_rate=1.0,
                tags=extracted_metric.get("tags"),
            ).encode()

            self._transport.capture_envelope(
                sdk_transport.Envelope(
                    headers=None,
                    items=[
                        sdk_transport.Item(
                            payload=payload,
                            type="metrics",
                            content_type="text",
                            headers={"timestamp": int(time.time())},
                        )
                    ],
                )
            )

    def add(
        self,
        ty: MetricType,
        key: str,
        value: MetricValue,
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
            cast(Tuple[Tuple[str, str], ...], tuple(sorted(tuple((tags or {}).items())))),
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

    def incr(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "nanosecond",
        tags: Optional[Tags] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        self.aggregator.add("c", key, value, unit, tags, timestamp)

    def timing(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "second",
        tags: Optional[Tags] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        self.aggregator.add("d", key, value, unit, tags, timestamp)

    def set(
        self,
        key: str,
        value: Union[str, int],
        tags: Optional[Tags] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        self.aggregator.add("s", key, value, None, tags, timestamp)

    def gauge(
        self,
        key: str,
        value: float,
        unit: MetricUnit = "second",
        tags: Optional[Tags] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        self.aggregator.add("g", key, value, unit, tags, timestamp)
