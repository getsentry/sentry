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
    "AVAILABLE_GENERIC_OPERATIONS",
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
    "CUSTOM_MEASUREMENT_DATASETS",
    "DATASET_COLUMNS",
    "NON_RESOLVABLE_TAG_VALUES",
)


import re
from abc import ABC
from datetime import datetime, timedelta, timezone
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
METRICS_LAYER_GRANULARITIES = [86400, 3600, 60]

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
    "rate",
    "count_web_vitals",
    "count_transaction_name",
    "team_key_transaction",
    "transform_null_to_unparameterized",
]
MetricUnit = Literal[
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
    "kibibyte",
    "mebibyte",
    "gibibyte",
    "tebibyte",
    "pebibyte",
    "exbibyte",
    "kilobyte",
    "megabyte",
    "gigabyte",
    "terabyte",
    "petabyte",
    "exabyte",
]
#: The type of metric, which determines the snuba entity to query
MetricType = Literal["counter", "set", "distribution", "numeric"]

MetricEntity = Literal[
    "metrics_counters",
    "metrics_sets",
    "metrics_distributions",
    "generic_metrics_counters",
    "generic_metrics_sets",
    "generic_metrics_distributions",
]

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
        "sum": "sumIf",
    },
    "metrics_sets": {"count_unique": "uniqIf"},
}
GENERIC_OP_TO_SNUBA_FUNCTION = {
    "generic_metrics_counters": OP_TO_SNUBA_FUNCTION["metrics_counters"],
    "generic_metrics_distributions": OP_TO_SNUBA_FUNCTION["metrics_distributions"],
    "generic_metrics_sets": OP_TO_SNUBA_FUNCTION["metrics_sets"],
}

# This set contains all the operations that require the "rhs" condition to be resolved
# in a "MetricConditionField". This solution is the simplest one and doesn't require any
# changes in the transformer, however it requires this list to be discovered and updated
# in case new operations are added, which is not ideal but given the fact that we already
# define operations in this file, it is not a deal-breaker.
REQUIRES_RHS_CONDITION_RESOLUTION = {"transform_null_to_unparameterized"}


def require_rhs_condition_resolution(op: MetricOperationType) -> bool:
    """
    Checks whether a given operation requires its right operand to be resolved.
    """
    return op in REQUIRES_RHS_CONDITION_RESOLUTION


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
AVAILABLE_GENERIC_OPERATIONS = {
    type_: sorted(mapping.keys()) for type_, mapping in GENERIC_OP_TO_SNUBA_FUNCTION.items()
}
OPERATIONS_TO_ENTITY = {
    op: entity for entity, operations in AVAILABLE_OPERATIONS.items() for op in operations
}
GENERIC_OPERATIONS_TO_ENTITY = {
    op: entity for entity, operations in AVAILABLE_GENERIC_OPERATIONS.items() for op in operations
}

# ToDo add gauges/summaries
METRIC_TYPE_TO_ENTITY: Mapping[MetricType, EntityKey] = {
    "counter": EntityKey.MetricsCounters,
    "set": EntityKey.MetricsSets,
    "distribution": EntityKey.MetricsDistributions,
    "generic_set": EntityKey.GenericMetricsSets,
    "generic_distribution": EntityKey.GenericMetricsDistributions,
}

FIELD_ALIAS_MAPPINGS = {"project": "project_id"}
NON_RESOLVABLE_TAG_VALUES = (
    {"team_key_transaction"} | set(FIELD_ALIAS_MAPPINGS.keys()) | set(FIELD_ALIAS_MAPPINGS.values())
)


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
    metric_id: Optional[int]
    mri_string: str


class MetricMetaWithTagKeys(MetricMeta):
    tags: Sequence[Tag]


OPERATIONS_PERCENTILES = (
    "p50",
    "p75",
    "p90",
    "p95",
    "p99",
)
DERIVED_OPERATIONS = (
    "histogram",
    "rate",
    "count_web_vitals",
    "count_transaction_name",
    "team_key_transaction",
    "transform_null_to_unparameterized",
)
OPERATIONS = (
    (
        "avg",
        "count_unique",
        "count",
        "max",
        "min",
        "sum",
    )
    + OPERATIONS_PERCENTILES
    + DERIVED_OPERATIONS
)

DEFAULT_AGGREGATES: Dict[MetricOperationType, Optional[Union[int, List[Tuple[float]]]]] = {
    "avg": None,
    "count_unique": 0,
    "count": 0,
    "min": None,
    "max": None,
    "p50": None,
    "p75": None,
    "p90": None,
    "p95": None,
    "p99": None,
    "sum": 0,
    "percentage": None,
}
UNIT_TO_TYPE = {
    "sessions": "count",
    "percentage": "percentage",
    "users": "count",
}
UNALLOWED_TAGS = {"session.status"}
DATASET_COLUMNS = {"project_id", "metric_id"}

# Custom measurements are always extracted as a distribution
CUSTOM_MEASUREMENT_DATASETS = {"generic_distribution"}


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


def get_intervals(start: datetime, end: datetime, granularity: int, interval: Optional[int] = None):
    if interval is None:
        assert granularity > 0
        delta = timedelta(seconds=granularity)
    else:
        start = datetime.fromtimestamp(int(start.timestamp() / interval) * interval, timezone.utc)
        end = datetime.fromtimestamp(int(end.timestamp() / interval) * interval, timezone.utc)
        assert interval > 0
        delta = timedelta(seconds=interval)
    while start < end:
        yield start
        start += delta
