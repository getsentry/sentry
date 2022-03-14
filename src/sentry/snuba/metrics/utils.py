__all__ = (
    "MAX_POINTS",
    "GRANULARITY",
    "TS_COL_QUERY",
    "TS_COL_GROUP",
    "FIELD_REGEX",
    "TAG_REGEX",
    "MetricOperation",
    "MetricUnit",
    "MetricType",
    "OP_TO_SNUBA_FUNCTION",
    "AVAILABLE_OPERATIONS",
    "OPERATIONS_TO_ENTITY",
    "METRIC_TYPE_TO_ENTITY",
    "ALLOWED_GROUPBY_COLUMNS",
    "Tag",
    "TagValue",
    "MetricMeta",
    "MetricMetaWithTagKeys",
    "OPERATIONS",
    "DEFAULT_AGGREGATES",
    "UNIT_TO_TYPE",
    "DerivedMetricParseException",
    "TimeRange",
)


import re
from datetime import datetime
from typing import Collection, Literal, Mapping, Optional, Protocol, Sequence, TypedDict

from sentry.snuba.dataset import EntityKey

MAX_POINTS = 10000
GRANULARITY = 24 * 60 * 60
TS_COL_QUERY = "timestamp"
TS_COL_GROUP = "bucketed_time"

#: Max number of data points per time series:
# ToDo modify this regex to only support the operations provided
FIELD_REGEX = re.compile(r"^(\w+)\(((\w|\.|_)+)\)$")
TAG_REGEX = re.compile(r"^(\w|\.|_)+$")

#: A function that can be applied to a metric
MetricOperation = Literal["avg", "count", "max", "min", "p50", "p75", "p90", "p95", "p99"]
MetricUnit = Literal["seconds"]
#: The type of metric, which determines the snuba entity to query
MetricType = Literal["counter", "set", "distribution", "numeric"]

MetricEntity = Literal["metrics_counters", "metrics_sets", "metrics_distribution"]

OP_TO_SNUBA_FUNCTION = {
    "metrics_counters": {"sum": "sumIf"},
    "metrics_distributions": {
        "avg": "avgIf",
        "count": "countIf",
        "max": "maxIf",
        "min": "minIf",
        # TODO: Would be nice to use `quantile(0.50)` (singular) here, but snuba responds with an error
        "p50": "quantilesIf(0.50)",
        "p75": "quantilesIf(0.75)",
        "p90": "quantilesIf(0.90)",
        "p95": "quantilesIf(0.95)",
        "p99": "quantilesIf(0.99)",
    },
    "metrics_sets": {"count_unique": "uniqIf"},
}


AVAILABLE_OPERATIONS = {
    type_: sorted(mapping.keys()) for type_, mapping in OP_TO_SNUBA_FUNCTION.items()
}
OPERATIONS_TO_ENTITY = {
    op: entity for entity, operations in AVAILABLE_OPERATIONS.items() for op in operations
}

# ToDo add guages/summaries
METRIC_TYPE_TO_ENTITY: Mapping[MetricType, EntityKey] = {
    "counter": EntityKey.MetricsCounters,
    "set": EntityKey.MetricsSets,
    "distribution": EntityKey.MetricsDistributions,
}

ALLOWED_GROUPBY_COLUMNS = ("project_id",)


class Tag(TypedDict):
    key: str  # Called key here to be consistent with JS type


class TagValue(TypedDict):
    key: str
    value: str


class MetricMeta(TypedDict):
    name: str
    type: MetricType
    operations: Collection[MetricOperation]
    unit: Optional[MetricUnit]


class MetricMetaWithTagKeys(MetricMeta):
    tags: Sequence[Tag]


_OPERATIONS_PERCENTILES = (
    "p50",
    "p75",
    "p90",
    "p95",
    "p99",
)

# ToDo Dynamically generate this from OP_TO_SNUBA_FUNCTION
OPERATIONS = (
    "avg",
    "count_unique",
    "count",
    "max",
    "sum",
) + _OPERATIONS_PERCENTILES

DEFAULT_AGGREGATES = {
    "avg": None,
    "count_unique": 0,
    "count": 0,
    "max": None,
    "p50": None,
    "p75": None,
    "p90": None,
    "p95": None,
    "p99": None,
    "sum": 0,
    "percentage": None,
}
UNIT_TO_TYPE = {"sessions": "count", "percentage": "percentage"}


class DerivedMetricParseException(Exception):
    ...


class MetricDoesNotExistException(Exception):
    ...


class MetricDoesNotExistInIndexer(Exception):
    ...


class TimeRange(Protocol):
    start: datetime
    end: datetime
    rollup: int
