""" Classes needed to build a metrics query. Inspired by snuba_sdk.query. """
from dataclasses import dataclass
from datetime import datetime
from enum import Flag, auto
from typing import Literal, Optional, Sequence, Union

from snuba_sdk import Direction, Granularity, Limit, Offset
from snuba_sdk.conditions import ConditionGroup

from .utils import MetricOperationType

# TODO: Add __all__ to be consistent with sibling modules


@dataclass(frozen=True)
class MetricField:
    op: Optional[MetricOperationType]
    metric_name: str


class Count(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("count", metric_name)


class CountUnique(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("count_unique", metric_name)


class Avg(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("avg", metric_name)


class Sum(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("sum", metric_name)


class Max(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("max", metric_name)


class Min(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("min", metric_name)


class Percentile50(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("p50", metric_name)


class Percentile75(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("p75", metric_name)


class Percentile90(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("p90", metric_name)


class Percentile95(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("p95", metric_name)


class Percentile99(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("p99", metric_name)


@dataclass(frozen=True)
class Histogram:
    metric_name: str

    @property
    def op(self) -> MetricOperationType:
        return "histogram"


@dataclass(frozen=True)
class DerivedMetric:
    metric_name: str

    @property
    def op(self) -> None:
        return None


Sortable = Union[MetricField, DerivedMetric]


Selectable = Union[Sortable, Histogram]

Tag = str
Groupable = Union[Tag, Literal["project_id"]]


@dataclass(frozen=True)
class OrderBy:
    field: Sortable
    direction: Direction


class QueryType(Flag):
    TOTALS = auto()
    SERIES = auto()
    BOTH = TOTALS | SERIES


@dataclass(frozen=True)
class QueryDefinition:
    """Definition of a metrics query, inspired by snuba_sdk.Query"""

    org_id: int
    project_ids: Sequence[int]
    select: Sequence[Selectable]
    start: datetime
    end: datetime
    granularity: Granularity
    where: Optional[ConditionGroup] = None  # TODO: Should restrict
    groupby: Optional[Sequence[Groupable]] = None
    orderby: Optional[OrderBy] = None
    limit: Optional[Limit] = None
    offset: Optional[Offset] = None
    type: QueryType = QueryType.BOTH

    # TODO: These should be properties of the Histogram field
    histogram_buckets: int = 100
    histogram_from: Optional[float] = None
    histogram_to: Optional[float] = None
