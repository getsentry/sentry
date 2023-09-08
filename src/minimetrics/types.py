from typing import (
    Any,
    Dict,
    Generic,
    List,
    Literal,
    Mapping,
    NamedTuple,
    Tuple,
    TypedDict,
    TypeVar,
    Union,
)

from typing_extensions import NotRequired

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

# Value of a metric that was extracted after bucketing.
ExtractedMetricValue = Union[int, float, List[Union[int, float]], Dict[str, Union[int, float]]]


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


T = TypeVar("T")


class Metric(Generic[T]):
    @property
    def weight(self) -> int:
        return 1

    def add(self, value: T) -> None:
        raise NotImplementedError()

    def serialize_value(self) -> Any:
        raise NotImplementedError()
