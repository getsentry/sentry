from typing import Generator, Generic, List, Literal, Mapping, NamedTuple, Tuple, TypeVar, Union

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


class BucketKey(NamedTuple):
    """
    Key of the bucket.
    """

    timestamp: int
    metric_type: MetricType
    metric_name: str
    metric_unit: MetricUnit
    metric_tags: MetricTagsInternal


T = TypeVar("T")


class Metric(Generic[T]):
    @property
    def weight(self) -> int:
        raise NotImplementedError()

    def add(self, value: T) -> None:
        raise NotImplementedError()

    def serialize_value(self) -> Generator[FlushedMetricValue, None, None]:
        raise NotImplementedError()


class FlushedMetric(NamedTuple):
    """
    Metric that is flushed by the flusher.
    """

    bucket_key: BucketKey
    metric: Metric
