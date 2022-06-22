__all__ = (
    "MAX_POINTS",
    "GRANULARITY",
    "TS_COL_QUERY",
    "TS_COL_GROUP",
    "TAG_REGEX",
    "MetricOperationType",
    "MetricUnit",
    "MetricType",
    "OP_TO_SNUBA_FUNCTION",
    "AVAILABLE_OPERATIONS",
    "OPERATIONS_TO_ENTITY",
    "METRIC_TYPE_TO_ENTITY",
    "FIELD_ALIAS_MAPPINGS",
    "Tag",
    "TagValue",
    "MetricMeta",
    "MetricMetaWithTagKeys",
    "OPERATIONS",
    "OPERATIONS_PERCENTILES",
    "DEFAULT_AGGREGATES",
    "UNIT_TO_TYPE",
    "DerivedMetricException",
    "DerivedMetricParseException",
    "MetricDoesNotExistException",
    "MetricDoesNotExistInIndexer",
    "NotSupportedOverCompositeEntityException",
    "OrderByNotSupportedOverCompositeEntityException",
    "MetricEntity",
    "UNALLOWED_TAGS",
    "combine_dictionary_of_list_values",
    "get_intervals",
    "OP_REGEX",
    "DATASET_COLUMNS",
)


import re
from abc import ABC
from datetime import datetime, timedelta
from typing import (
    Collection,
    Dict,
    List,
    Literal,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    TypedDict,
    Union,
)

from sentry.snuba.dataset import EntityKey

#: Max number of data points per time series:
MAX_POINTS = 10000
GRANULARITY = 24 * 60 * 60
TS_COL_QUERY = "timestamp"
TS_COL_GROUP = "bucketed_time"

TAG_REGEX = re.compile(r"^([\w.]+)$")

#: A function that can be applied to a metric
MetricOperationType = Literal[
    "avg",
    "count",
    "count_unique",
    "sum",
    "max",
    "min",
    "p50",
    "p75",
    "p90",
    "p95",
    "p99",
    "histogram",
]
MetricUnit = Literal["seconds"]
#: The type of metric, which determines the snuba entity to query
MetricType = Literal["counter", "set", "distribution", "numeric"]

MetricEntity = Literal["metrics_counters", "metrics_sets", "metrics_distributions"]

OP_TO_SNUBA_FUNCTION = {
    "metrics_counters": {"sum": "sumIf"},
    "metrics_distributions": {
        "avg": "avgIf",
        "count": "countIf",
        "max": "maxIf",
        "min": "minIf",
        "p50": "quantilesIf(0.50)",  # TODO: Would be nice to use `quantile(0.50)` (singular) here, but snuba responds with an error
        "p75": "quantilesIf(0.75)",
        "p90": "quantilesIf(0.90)",
        "p95": "quantilesIf(0.95)",
        "p99": "quantilesIf(0.99)",
        "histogram": "histogramIf(250)",
    },
    "metrics_sets": {"count_unique": "uniqIf"},
}


def generate_operation_regex():
    """
    Generates a regex of all supported operations defined in OP_TO_SNUBA_FUNCTION
    """
    operations = []
    for item in OP_TO_SNUBA_FUNCTION.values():
        operations += list(item.keys())
    return rf"({'|'.join(map(str, operations))})"


OP_REGEX = generate_operation_regex()


AVAILABLE_OPERATIONS = {
    type_: sorted(mapping.keys()) for type_, mapping in OP_TO_SNUBA_FUNCTION.items()
}
OPERATIONS_TO_ENTITY = {
    op: entity for entity, operations in AVAILABLE_OPERATIONS.items() for op in operations
}

# ToDo add gauges/summaries
METRIC_TYPE_TO_ENTITY: Mapping[MetricType, EntityKey] = {
    "counter": EntityKey.MetricsCounters,
    "set": EntityKey.MetricsSets,
    "distribution": EntityKey.MetricsDistributions,
}

FIELD_ALIAS_MAPPINGS = {"project": "project_id"}


class Tag(TypedDict):
    key: str  # Called key here to be consistent with JS type


class TagValue(TypedDict):
    key: str
    value: str


class MetricMeta(TypedDict):
    name: str
    type: MetricType
    operations: Collection[MetricOperationType]
    unit: Optional[MetricUnit]


class MetricMetaWithTagKeys(MetricMeta):
    tags: Sequence[Tag]


OPERATIONS_PERCENTILES = (
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
    "histogram",
) + OPERATIONS_PERCENTILES

DEFAULT_AGGREGATES: Dict[MetricOperationType, Optional[Union[int, List[Tuple[float]]]]] = {
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
    "histogram": [],
}
UNIT_TO_TYPE = {"sessions": "count", "percentage": "percentage", "users": "count"}
UNALLOWED_TAGS = {"session.status"}
DATASET_COLUMNS = {"project_id", "metric_id"}


def combine_dictionary_of_list_values(main_dict, other_dict):
    """
    Function that combines dictionary of lists. For instance, let's say we have
    Dict A -> {"a": [1,2], "b": [3]} and Dict B -> {"a": [6], "c": [4]}
    Calling this function would result in {"a": [1, 2, 6], "b": [3], "c": [4]}
    """
    if not isinstance(main_dict, dict) or not isinstance(other_dict, dict):
        raise TypeError()
    for key, value in other_dict.items():
        main_dict.setdefault(key, [])
        if not isinstance(value, list) or not isinstance(main_dict[key], list):
            raise TypeError()
        main_dict[key] += value
        main_dict[key] = list(set(main_dict[key]))
    return main_dict


class MetricDoesNotExistException(Exception):
    ...


class MetricDoesNotExistInIndexer(Exception):
    ...


class DerivedMetricException(Exception, ABC):
    ...


class DerivedMetricParseException(DerivedMetricException):
    ...


class NotSupportedOverCompositeEntityException(DerivedMetricException):
    ...


class OrderByNotSupportedOverCompositeEntityException(NotSupportedOverCompositeEntityException):
    ...


def get_intervals(start: datetime, end: datetime, granularity: int):
    assert granularity > 0
    delta = timedelta(seconds=granularity)
    while start < end:
        yield start
        start += delta
