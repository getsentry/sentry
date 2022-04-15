from dataclasses import dataclass
from datetime import datetime
from enum import Enum, Flag, auto
from typing import Literal, Optional, Sequence, Union

from attr import field
from snuba_sdk import Direction, Granularity, Limit, Offset
from snuba_sdk.conditions import ConditionGroup

# TODO: Add __all__ to be consistent with sibling modules


class Aggregation(Enum):
    AVG = "avg"
    COUNT = "count"
    MAX = "max"
    MIN = "min"
    SUM = "sum"
    UNIQ = "uniq"
    PERCENTILE = "percentile"
    HISTOGRAM = "histogram"


@dataclass(frozen=True)
class AggregatedMetric:
    aggregation: Aggregation
    metric_name: str


class Sum(AggregatedMetric):
    def __init__(self, metric_name: str):
        super().__init__(Aggregation.SUM, metric_name)


class Uniq(AggregatedMetric):
    def __init__(self, metric_name: str):
        super().__init__(Aggregation.UNIQ, metric_name)


class Percentile(AggregatedMetric):
    # TODO: Is this still hashable, etc.?
    def __init__(self, metric_name: str, percentile: int):
        super().__init__(Aggregation.PERCENTILE, metric_name)
        self.percentile = percentile


@dataclass(frozen=True)
class Histogram:
    metric_name: str
    buckets: int = 100
    from_: Optional[float] = None
    to: Optional[float] = None
    aggregation: Aggregation = field(init=False, default=Aggregation.HISTOGRAM)


@dataclass(frozen=True)
class DerivedMetric:
    metric_name: str
    aggregation: Optional[Aggregation] = field(init=False, default=None)


Sortable = Union[AggregatedMetric, DerivedMetric]


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
