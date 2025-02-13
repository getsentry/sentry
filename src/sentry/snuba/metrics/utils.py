from __future__ import annotations

import re
from abc import ABC
from collections.abc import Collection, Generator, Mapping, Sequence
from datetime import datetime, timedelta, timezone
from typing import Literal, NotRequired, TypedDict, TypeIs, overload

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.dataset import EntityKey

__all__ = (
    "MAX_POINTS",
    "GRANULARITY",
    "TS_COL_GROUP",
    "TAG_REGEX",
    "MetricOperationType",
    "MetricType",
    "OP_TO_SNUBA_FUNCTION",
    "AVAILABLE_OPERATIONS",
    "AVAILABLE_GENERIC_OPERATIONS",
    "OPERATIONS_TO_ENTITY",
    "METRIC_TYPE_TO_ENTITY",
    "FILTERABLE_TAGS",
    "FIELD_ALIAS_MAPPINGS",
    "Tag",
    "TagValue",
    "MetricMeta",
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
    "get_num_intervals",
    "to_intervals",
    "OP_REGEX",
    "CUSTOM_MEASUREMENT_DATASETS",
    "DATASET_COLUMNS",
    "NON_RESOLVABLE_TAG_VALUES",
)


#: Max number of data points per time series:
MAX_POINTS = 10000
GRANULARITY = 24 * 60 * 60
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
    "p100",
    "percentage",
    "histogram",
    "rate",
    "count_web_vitals",
    "count_transaction_name",
    "team_key_transaction",
    "sum_if_column",
    "uniq_if_column",
    "min_timestamp",
    "max_timestamp",
    "last",
    # Custom operations used for on demand derived metrics.
    "on_demand_apdex",
    "on_demand_epm",
    "on_demand_eps",
    "on_demand_failure_count",
    "on_demand_failure_rate",
    "on_demand_count_unique",
    "on_demand_count_web_vitals",
    "on_demand_user_misery",
]
#: The type of metric, which determines the snuba entity to query
MetricType = Literal[
    "counter",
    "set",
    "distribution",
    "numeric",
    "generic_counter",
    "generic_set",
    "generic_distribution",
    "generic_gauge",
]

MetricEntity = Literal[
    "metrics_counters",
    "metrics_sets",
    "metrics_distributions",
    "generic_metrics_counters",
    "generic_metrics_sets",
    "generic_metrics_distributions",
    "generic_metrics_gauges",
]


def is_metric_entity(s: str) -> TypeIs[MetricEntity]:
    return s in {
        "metrics_counters",
        "metrics_sets",
        "metrics_distributions",
        "generic_metrics_counters",
        "generic_metrics_sets",
        "generic_metrics_distributions",
        "generic_metrics_gauges",
    }


OP_TO_SNUBA_FUNCTION: dict[MetricEntity, dict[MetricOperationType, str]] = {
    "metrics_counters": {
        "sum": "sumIf",
        "min_timestamp": "minIf",
        "max_timestamp": "maxIf",
    },
    "metrics_distributions": {
        "avg": "avgIf",
        "count": "countIf",
        "max": "maxIf",
        "min": "minIf",
        "p50": "quantilesIf(0.50)",
        # TODO: Would be nice to use `quantile(0.50)` (singular) here, but snuba responds with an error
        "p75": "quantilesIf(0.75)",
        "p90": "quantilesIf(0.90)",
        "p95": "quantilesIf(0.95)",
        "p99": "quantilesIf(0.99)",
        "histogram": "histogramIf(250)",
        "sum": "sumIf",
        "min_timestamp": "minIf",
        "max_timestamp": "maxIf",
    },
    "metrics_sets": {
        "count_unique": "uniqIf",
        "min_timestamp": "minIf",
        "max_timestamp": "maxIf",
    },
}
GENERIC_OP_TO_SNUBA_FUNCTION: dict[MetricEntity, dict[MetricOperationType, str]] = {
    "generic_metrics_counters": OP_TO_SNUBA_FUNCTION["metrics_counters"],
    "generic_metrics_distributions": OP_TO_SNUBA_FUNCTION["metrics_distributions"],
    "generic_metrics_sets": OP_TO_SNUBA_FUNCTION["metrics_sets"],
    # Gauges are not supported by non-generic metrics.
    "generic_metrics_gauges": {
        "min": "minIf",
        "max": "maxIf",
        "sum": "sumIf",
        "count": "countIf",
        "last": "lastIf",
        "avg": "avg",
    },
}

USE_CASE_ID_TO_ENTITY_KEYS = {
    UseCaseID.SESSIONS: {
        EntityKey.MetricsCounters,
        EntityKey.MetricsSets,
        EntityKey.MetricsDistributions,
    },
    UseCaseID.SPANS: {
        EntityKey.GenericMetricsCounters,
        EntityKey.GenericMetricsSets,
        EntityKey.GenericMetricsDistributions,
        EntityKey.GenericMetricsGauges,
    },
    UseCaseID.TRANSACTIONS: {
        EntityKey.GenericMetricsCounters,
        EntityKey.GenericMetricsSets,
        EntityKey.GenericMetricsDistributions,
    },
    UseCaseID.PROFILES: {
        EntityKey.GenericMetricsCounters,
        EntityKey.GenericMetricsSets,
        EntityKey.GenericMetricsDistributions,
    },
    UseCaseID.METRIC_STATS: {
        EntityKey.GenericMetricsCounters,
        EntityKey.GenericMetricsGauges,
    },
}

# This set contains all the operations that require the "rhs" condition to be resolved
# in a "MetricConditionField". This solution is the simplest one and doesn't require any
# changes in the transformer, however it requires this list to be discovered and updated
# in case new operations are added, which is not ideal but given the fact that we already
# define operations in this file, it is not a deal-breaker.
REQUIRES_RHS_CONDITION_RESOLUTION = {"transform_null_to_unparameterized"}


def get_entity_keys_of_use_case_id(use_case_id: UseCaseID) -> set[EntityKey] | None:
    """
    Returns a set of entity keys that are available for the use_case_id.

    In case the use case id doesn't have known entities, the function will return `None`.
    """
    return USE_CASE_ID_TO_ENTITY_KEYS.get(use_case_id)


def get_timestamp_column_name() -> str:
    """
    Returns the column name of the timestamp column in Snuba.

    The name of the timestamp column can change based on the entity.
    """
    return "timestamp"


def require_rhs_condition_resolution(op: MetricOperationType) -> bool:
    """
    Checks whether a given operation requires its right operand to be resolved.
    """
    return op in REQUIRES_RHS_CONDITION_RESOLUTION


def generate_operation_regex():
    """
    Generates a regex of all supported operations defined in OP_TO_SNUBA_FUNCTION
    """
    operations = set()
    for item in OP_TO_SNUBA_FUNCTION.values():
        operations.update(set(item.keys()))
    for item in GENERIC_OP_TO_SNUBA_FUNCTION.values():
        operations.update(set(item.keys()))

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

METRIC_TYPE_TO_ENTITY: Mapping[MetricType, EntityKey] = {
    "counter": EntityKey.MetricsCounters,
    "set": EntityKey.MetricsSets,
    "distribution": EntityKey.MetricsDistributions,
    "generic_counter": EntityKey.GenericMetricsCounters,
    "generic_set": EntityKey.GenericMetricsSets,
    "generic_distribution": EntityKey.GenericMetricsDistributions,
    "generic_gauge": EntityKey.GenericMetricsGauges,
}

FIELD_ALIAS_MAPPINGS = {"project": "project_id"}
NON_RESOLVABLE_TAG_VALUES = (
    {"team_key_transaction"} | set(FIELD_ALIAS_MAPPINGS.keys()) | set(FIELD_ALIAS_MAPPINGS.values())
)
FILTERABLE_TAGS = {
    "tags[environment]",
    "tags[transaction]",
    "tags[transaction.op]",
    "tags[transaction.status]",
    "tags[browser.name]",
    "tags[os.name]",
    "tags[release]",
    "tags[histogram_outlier]",
    "tags[geo.country_code]",
    "tags[http.status_code]",
}


def entity_key_to_metric_type(entity_key: EntityKey) -> MetricType | None:
    """
    Returns the `MetricType` corresponding to the supplied `EntityKey`.

    This function traverses in reverse the `METRIC_TYPE_TO_ENTITY` to avoid duplicating it
    with the inverted values. Access still remains O(1) given that the size of the dictionary
    is assumed to be fixed during the lifecycle of the program.
    """
    for metric_type, inner_entity_key in METRIC_TYPE_TO_ENTITY.items():
        if entity_key == inner_entity_key:
            return metric_type

    return None


class Tag(TypedDict):
    key: str  # Called key here to be consistent with JS type


class TagValue(TypedDict):
    key: str
    value: str


class MetricMeta(TypedDict):
    name: str
    type: MetricType
    operations: Collection[MetricOperationType]
    unit: str | None
    metric_id: NotRequired[int]
    mri: str
    projectIds: Sequence[int]


OPERATIONS_PERCENTILES = (
    "p50",
    "p75",
    "p90",
    "p95",
    "p99",
    "p100",
)
DERIVED_OPERATIONS = (
    "histogram",
    "rate",
    "count_web_vitals",
    "count_transaction_name",
    "team_key_transaction",
    "transform_null_to_unparameterized",
    "sum_if_column",
    "uniq_if_column",
    "min_timestamp",
    "max_timestamp",
    # Custom operations used for on demand derived metrics.
    "on_demand_apdex",
    "on_demand_epm",
    "on_demand_eps",
    "on_demand_failure_count",
    "on_demand_failure_rate",
    "on_demand_count_unique",
    "on_demand_count_web_vitals",
    "on_demand_user_misery",
)
OPERATIONS = (
    ("avg", "count_unique", "count", "max", "min", "sum", "last")
    + OPERATIONS_PERCENTILES
    + DERIVED_OPERATIONS
)

DEFAULT_AGGREGATES: dict[MetricOperationType, int | list[tuple[float]] | None] = {
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
    "last": None,
}
UNIT_TO_TYPE: dict[str, MetricOperationType] = {
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
    pass


class MetricDoesNotExistInIndexer(Exception):
    pass


class DerivedMetricException(Exception, ABC):
    pass


class DerivedMetricParseException(DerivedMetricException):
    pass


class NotSupportedOverCompositeEntityException(DerivedMetricException):
    pass


class OrderByNotSupportedOverCompositeEntityException(NotSupportedOverCompositeEntityException):
    pass


@overload
def to_intervals(start: None, end: datetime, interval_seconds: int) -> tuple[None, None, int]: ...


@overload
def to_intervals(start: datetime, end: None, interval_seconds: int) -> tuple[None, None, int]: ...


@overload
def to_intervals(start: None, end: None, interval_seconds: int) -> tuple[None, None, int]: ...


@overload
def to_intervals(
    start: datetime, end: datetime, interval_seconds: int
) -> tuple[datetime, datetime, int]: ...


def to_intervals(
    start: datetime | None, end: datetime | None, interval_seconds: int
) -> tuple[datetime, datetime, int] | tuple[None, None, int]:
    """
    Given a `start` date, `end` date and an alignment interval in seconds returns the aligned start, end and
    the number of total intervals in [start:end]

    """
    assert interval_seconds > 0

    # horrible hack for backward compatibility
    # TODO: Try to fix this upstream
    if start is None or end is None:
        return None, None, 0

    if start.tzinfo is None:
        start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end.replace(tzinfo=timezone.utc)

    interval_start = int(start.timestamp() / interval_seconds) * interval_seconds
    interval_end = end.timestamp()

    seconds_to_cover = interval_end - interval_start

    last_incomplete_interval = 0
    if seconds_to_cover % interval_seconds != 0:
        # we don't finish neatly at the end of interval, add another
        # interval to cover the last incomplete period
        last_incomplete_interval = 1

    num_intervals = int(seconds_to_cover / interval_seconds) + last_incomplete_interval
    # finally convert back to dates
    adjusted_start = datetime.fromtimestamp(interval_start, timezone.utc)
    adjusted_end = adjusted_start + timedelta(seconds=interval_seconds * num_intervals)
    return adjusted_start, adjusted_end, num_intervals


def get_num_intervals(
    start: datetime | None,
    end: datetime | None,
    granularity: int,
    interval: int | None = None,
) -> int:
    """
    Calculates the number of intervals from start to end.
    If start==None then it calculates from the beginning of unix time (for backward compatibility with
    MetricsQuery.calculate_intervals_len)
    """

    # legacy usage (if no start time assume beginning of Unix time)
    if start is None:
        start = datetime.fromtimestamp(0).replace(tzinfo=timezone.utc)

    if interval is None:
        interval = granularity

    assert interval > 0

    _start, _end, num_intervals = to_intervals(start, end, interval)
    return num_intervals


def get_intervals(
    start: datetime, end: datetime, granularity: int, interval: int | None = None
) -> Generator[datetime]:
    if interval is None:
        interval = granularity

    start, _end, num_intervals = to_intervals(start, end, interval)

    interval_span = timedelta(seconds=interval)
    idx = 0

    while idx < num_intervals:
        yield start
        idx += 1
        start += interval_span
