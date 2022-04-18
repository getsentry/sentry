""" Classes needed to build a metrics query. Inspired by snuba_sdk.query. """
from dataclasses import dataclass
from datetime import datetime
from enum import Enum, Flag, auto
from typing import Literal, Optional, Sequence, Union

from attr import field
from snuba_sdk import Direction, Granularity, Limit, Offset
from snuba_sdk.conditions import ConditionGroup

from .utils import MetricOperationType

# TODO: Add __all__ to be consistent with sibling modules


@dataclass(frozen=True)
class MetricField:
    op: Optional[MetricOperationType]
    metric_name: str


class Sum(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("sum", metric_name)


class CountUnique(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("count_unique", metric_name)


class Percentile95(MetricField):
    def __init__(self, metric_name: str):
        super().__init__("p95", metric_name)


@dataclass(frozen=True)
class Histogram:
    metric_name: str
    buckets: int = 100
    from_: Optional[float] = None
    to: Optional[float] = None
    op: MetricOperationType = field(init=False, default="histogram")


@dataclass(frozen=True)
class DerivedMetric:
    metric_name: str
    op: Optional[MetricOperationType] = field(init=False, default=None)


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
class MetricsQuery:
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
