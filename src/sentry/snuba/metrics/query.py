""" Classes needed to build a metrics query. Inspired by snuba_sdk.query. """
import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal, Optional, Sequence, Union

from snuba_sdk import Direction, Granularity, Limit, Offset
from snuba_sdk.conditions import ConditionGroup

from sentry.api.utils import InvalidParams

from .utils import MAX_POINTS, MetricOperationType

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

    def __post_init__(self) -> None:
        # Validate series limit
        intervals_len = math.ceil(
            (self.end - self.start).total_seconds() / self.granularity.granularity
        )
        if self.limit is not None:
            if self.limit.limit > MAX_POINTS:
                raise InvalidParams(
                    f"Requested limit exceeds the maximum allowed limit of {MAX_POINTS}"
                )
            if self.include_series:
                if intervals_len * self.limit.limit > MAX_POINTS:
                    raise InvalidParams(
                        f"Requested interval of timedelta of "
                        f"{timedelta(seconds=self.granularity.granularity)} with statsPeriod "
                        f"timedelta of {self.end-self.start} is too granular for a per_page of "
                        f"{self.limit.limit} elements. Increase your interval, decrease your "
                        f"statsPeriod, or decrease your per_page parameter."
                    )
        else:
            totals_limit = MAX_POINTS
            if self.include_series:
                # In a series query, we also need to factor in the len of the intervals
                # array. The number of totals should never get so large that the
                # intervals exceed MAX_POINTS, however at least a single group.
                totals_limit = max(totals_limit // intervals_len, 1)
            # Cannot set attribute directly because dataclass is frozen:
            # https://docs.python.org/3/library/dataclasses.html#frozen-instances
            object.__setattr__(self, "limit", Limit(totals_limit))
