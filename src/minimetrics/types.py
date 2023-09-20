from typing import (
    Any,
    Dict,
    Generic,
    Iterable,
    List,
    Literal,
    Mapping,
    Sequence,
    Tuple,
    TypeVar,
    Union,
)

# Unit of the metrics.
MetricUnit = Literal[
    "none",
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

# Value inside the generator for the metric value.
FlushedMetricValue = Union[int, float]

BucketKey = Tuple[MetricType, str, MetricUnit, MetricTagsInternal]

T = TypeVar("T")


class Metric(Generic[T]):
    __slots__ = ()

    @property
    def weight(self) -> int:
        raise NotImplementedError()

    def add(self, value: T) -> None:
        raise NotImplementedError()

    def serialize_value(self) -> Iterable[FlushedMetricValue]:
        raise NotImplementedError()


FlushableMetric = Tuple[int, BucketKey, Metric[Any]]
FlushableBuckets = Sequence[Tuple[int, Dict[BucketKey, Metric[Any]]]]
