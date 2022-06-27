""" Classes needed to build a metrics query. Inspired by snuba_sdk.query. """
import math
from collections import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal, Optional, Sequence, Union

from snuba_sdk import Column, Direction, Function, Granularity, Limit, Offset
from snuba_sdk.conditions import Condition, ConditionGroup

from sentry.api.utils import InvalidParams
from sentry.snuba.metrics.fields import metric_object_factory
from sentry.snuba.metrics.fields.base import get_derived_metrics
from sentry.utils.dates import to_timestamp

# TODO: Add __all__ to be consistent with sibling modules
from ...models import ONE_DAY
from ...release_health.base import AllowedResolution
from .naming_layer.mapping import get_mri
from .utils import (
    MAX_POINTS,
    OPERATIONS,
    UNALLOWED_TAGS,
    DerivedMetricParseException,
    MetricOperationType,
)


@dataclass(frozen=True)
class MetricField:
    op: Optional[MetricOperationType]
    metric_name: str

    def __str__(self) -> str:
        return f"{self.op}({self.metric_name})" if self.op else self.metric_name


Tag = str
Groupable = Union[Tag, Literal["project_id"]]

MAX_HISTOGRAM_BUCKET = 250


@dataclass(frozen=True)
class OrderBy:
    field: MetricField
    direction: Direction


class MetricsQueryValidationRunner:
    def __post_init__(self) -> None:
        """Run validation methods if declared.
        The validation method can be a simple check
        that raises ValueError or a transformation to
        the field value.
        The validation is performed by calling a function named:
            `validate_<field_name>(self) -> None`
        """
        for name, _ in self.__dataclass_fields__.items():  # type: ignore
            if method := getattr(self, f"validate_{name}", None):
                method()


@dataclass(frozen=True)
class MetricsQuery(MetricsQueryValidationRunner):
    """Definition of a metrics query, inspired by snuba_sdk.Query"""

    org_id: int
    project_ids: Sequence[int]
    select: Sequence[MetricField]
    start: datetime
    end: datetime
    granularity: Granularity
    where: Optional[ConditionGroup] = None  # TODO: Should restrict
    groupby: Optional[Sequence[Groupable]] = None
    orderby: Optional[Sequence[OrderBy]] = None
    limit: Optional[Limit] = None
    offset: Optional[Offset] = None
    include_totals: bool = True
    include_series: bool = True

    # TODO(ahmed): These should be properties of the Histogram field. We need to extend MetricField
    #  to accept params and we should pass histogram fields as params on a specific instance of
    #  MetricField rather than them living on an instance of MetricsQuery
    histogram_buckets: int = 100
    histogram_from: Optional[float] = None
    histogram_to: Optional[float] = None

    @staticmethod
    def _validate_field(field: MetricField) -> None:
        derived_metrics_mri = get_derived_metrics(exclude_private=True)
        metric_mri = get_mri(field.metric_name)

        if field.op:
            if field.op not in OPERATIONS:
                raise InvalidParams(
                    f"Invalid operation '{field.op}'. Must be one of {', '.join(OPERATIONS)}"
                )
            if metric_mri in derived_metrics_mri:
                raise DerivedMetricParseException(
                    f"Failed to parse {field.op}({field.metric_name}). No operations can be "
                    f"applied on this field as it is already a derived metric with an "
                    f"aggregation applied to it."
                )

    def validate_select(self) -> None:
        if len(self.select) == 0:
            raise InvalidParams('Request is missing a "field"')
        for field in self.select:
            self._validate_field(field)

    def validate_where(self) -> None:
        if not self.where:
            return
        for condition in self.where:
            if (
                isinstance(condition, Condition)
                and isinstance(condition.lhs, Function)
                and condition.lhs.function == "ifNull"
            ):
                parameter = condition.lhs.parameters[0]
                if isinstance(parameter, Column) and parameter.name.startswith("tags["):
                    tag_name = parameter.name.split("tags[")[1].split("]")[0]
                    if tag_name in UNALLOWED_TAGS:
                        raise InvalidParams(f"Tag name {tag_name} is not a valid query filter")

    def validate_orderby(self) -> None:
        if not self.orderby:
            return

        for orderby in self.orderby:
            self._validate_field(orderby.field)

        orderby_fields, metric_entities = set(), set()
        for f in self.orderby:
            orderby_fields.add(f.field)

            metric_mri = get_mri(f.field.metric_name)
            # Construct a metrics expression
            metric_field_obj = metric_object_factory(f.field.op, metric_mri)
            entity = metric_field_obj.get_entity(self.project_ids)

            if isinstance(entity, Mapping):
                metric_entities.update(entity.keys())
            else:
                metric_entities.add(entity)
        # If metric entities set contanis more than 1 metric, we can't orderBy these fields
        if len(metric_entities) > 1:
            raise InvalidParams(
                "'orderBy' field functions must be from one group of snuba functions"
            )

        # validate all orderby columns are presented in provided 'fields'
        if set(self.select).issuperset(orderby_fields):
            return

        raise InvalidParams("'orderBy' must be one of the provided 'fields'")

    @staticmethod
    def calculate_intervals_len(
        end: datetime, granularity: int, start: Optional[datetime] = None
    ) -> int:
        range_in_sec = (end - start).total_seconds() if start is not None else to_timestamp(end)
        return math.ceil(range_in_sec / granularity)

    def validate_limit(self) -> None:
        if self.limit is None:
            return
        intervals_len = self.calculate_intervals_len(
            end=self.end, start=self.start, granularity=self.granularity.granularity
        )
        if self.limit.limit > MAX_POINTS:
            raise InvalidParams(
                f"Requested limit exceeds the maximum allowed limit of {MAX_POINTS}"
            )
        if self.include_series:
            if intervals_len * self.limit.limit > MAX_POINTS:
                raise InvalidParams(
                    f"Requested interval of timedelta of "
                    f"{timedelta(seconds=self.granularity.granularity)} with statsPeriod "
                    f"timedelta of {self.end - self.start} is too granular for a per_page of "
                    f"{self.limit.limit} elements. Increase your interval, decrease your "
                    f"statsPeriod, or decrease your per_page parameter."
                )

    def validate_groupby(self) -> None:
        if not self.groupby:
            return
        for field in self.groupby:
            if field in UNALLOWED_TAGS:
                raise InvalidParams(f"Tag name {field} cannot be used to groupBy query")

    def validate_histogram_buckets(self) -> None:
        # Validate histogram bucket count
        if self.histogram_buckets > MAX_HISTOGRAM_BUCKET:
            raise InvalidParams(
                f"We don't have more than {MAX_HISTOGRAM_BUCKET} buckets stored for any "
                f"given metric bucket."
            )

    def validate_include_totals(self) -> None:
        if self.include_totals or self.include_series:
            return
        raise InvalidParams("Cannot omit both series and totals")

    def get_default_limit(self) -> int:
        totals_limit: int = MAX_POINTS
        if self.include_series:
            intervals_len = self.calculate_intervals_len(
                start=self.start, end=self.end, granularity=self.granularity.granularity
            )
            # In a series query, we also need to factor in the len of the intervals
            # array. The number of totals should never get so large that the
            # intervals exceed MAX_POINTS, however at least a single group.
            totals_limit = max(totals_limit // intervals_len, 1)
        return totals_limit

    def validate_end(self) -> None:
        if self.start >= self.end:
            raise InvalidParams("start must be before end")

    def validate_granularity(self) -> None:
        # hard code min. allowed resolution to 10 seconds
        allowed_resolution = AllowedResolution.ten_seconds

        smallest_interval, interval_str = allowed_resolution.value
        if (
            self.granularity.granularity % smallest_interval != 0
            or self.granularity.granularity < smallest_interval
        ):
            raise InvalidParams(
                f"The interval has to be a multiple of the minimum interval of {interval_str}."
            )

        if ONE_DAY % self.granularity.granularity != 0:
            raise InvalidParams("The interval should divide one day without a remainder.")

        if (self.end - self.start).total_seconds() / self.granularity.granularity > MAX_POINTS:
            raise InvalidParams(
                "Your interval and date range would create too many results. "
                "Use a larger interval, or a smaller date range."
            )

    def __post_init__(self) -> None:
        super().__post_init__()

        if self.limit is None:
            # Cannot set attribute directly because dataclass is frozen:
            # https://docs.python.org/3/library/dataclasses.html#frozen-instances
            object.__setattr__(self, "limit", Limit(self.get_default_limit()))
