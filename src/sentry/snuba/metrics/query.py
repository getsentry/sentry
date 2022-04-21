""" Classes needed to build a metrics query. Inspired by snuba_sdk.query. """
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional, Sequence, Union

from snuba_sdk import Direction, Granularity, Limit, Offset
from snuba_sdk.conditions import ConditionGroup

from .utils import MetricOperationType

# TODO: Add __all__ to be consistent with sibling modules


@dataclass(frozen=True)
class MetricField:
    op: Optional[MetricOperationType]
    metric_name: str


Tag = str
Groupable = Union[Tag, Literal["project_id"]]


@dataclass(frozen=True)
class OrderBy:
    field: MetricField
    direction: Direction


@dataclass(frozen=True)
class QueryDefinition:
    """Definition of a metrics query, inspired by snuba_sdk.Query"""

    org_id: int
    project_ids: Sequence[int]
    select: Sequence[MetricField]
    start: datetime
    end: datetime
    granularity: Granularity
    where: Optional[ConditionGroup] = None  # TODO: Should restrict
    groupby: Optional[Sequence[Groupable]] = None
    orderby: Optional[OrderBy] = None
    limit: Optional[Limit] = None
    offset: Optional[Offset] = None
    include_totals: bool = True
    include_series: bool = True

    # TODO: These should be properties of the Histogram field
    histogram_buckets: int = 100
    histogram_from: Optional[float] = None
    histogram_to: Optional[float] = None
