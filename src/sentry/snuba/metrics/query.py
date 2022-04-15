from dataclasses import dataclass
from datetime import datetime
from enum import Enum, Flag, auto
from typing import Literal, Optional, Sequence, Union

from snuba_sdk import Direction, Granularity, Limit, Offset
from snuba_sdk.conditions import ConditionGroup


class Aggregation(Enum):
    SUM = "sum"


@dataclass(frozen=True)
class AggregatedMetric:
    aggregation: Aggregation
    metric_name: str


class Sum(AggregatedMetric):
    def __init__(self, metric_name: str):
        super().__init__(Aggregation.SUM, metric_name)


@dataclass(frozen=True)
class DerivedMetric:
    metric_name: str


Sortable = Union[AggregatedMetric, DerivedMetric]


@dataclass(frozen=True)
class Histogram:
    metric_name: str
    buckets: int = 100
    from_: Optional[float] = None
    to: Optional[float] = None


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
    type: QueryType
    select: Sequence[Selectable]
    start: datetime
    end: datetime
    where: Optional[ConditionGroup]  # TODO: Should restrict
    groupby: Optional[Sequence[Groupable]]
    orderby: Optional[OrderBy]
    limit: Optional[Limit]
    offset: Optional[Offset]
    granularity: Optional[Granularity]
