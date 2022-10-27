""" Classes needed to build a metrics query. Inspired by snuba_sdk.query. """
import math
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import cached_property
from typing import Dict, Literal, Optional, Sequence, Set, Tuple, Union

from django.db.models import QuerySet
from snuba_sdk import Column, Direction, Granularity, Limit, Offset, Op
from snuba_sdk.conditions import BooleanCondition, Condition

from sentry.api.utils import InvalidParams
from sentry.models import Project
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics.fields import metric_object_factory
from sentry.snuba.metrics.fields.base import get_derived_metrics
from sentry.snuba.metrics.naming_layer.mri import parse_mri
from sentry.utils.dates import to_timestamp

# TODO: Add __all__ to be consistent with sibling modules
from ...models import ONE_DAY
from ...release_health.base import AllowedResolution
from .naming_layer.mapping import get_public_name_from_mri
from .utils import (
    MAX_POINTS,
    METRICS_LAYER_GRANULARITIES,
    OPERATIONS,
    UNALLOWED_TAGS,
    DerivedMetricParseException,
    MetricOperationType,
)


@dataclass(frozen=True)
class MetricField:
    op: Optional[MetricOperationType]
    metric_mri: str
    params: Optional[Dict[str, Union[str, int, float, Sequence[Tuple[Union[str, int]]]]]] = None
    alias: Optional[str] = None

    def __post_init__(self) -> None:
        # Validate that it is a valid MRI format
        parsed_mri = parse_mri(self.metric_mri)
        if parsed_mri is None:
            raise InvalidParams(f"Invalid Metric MRI: {self.metric_mri}")

        # Validates that the MRI requested is an MRI the metrics layer exposes
        metric_name = get_public_name_from_mri(self.metric_mri)
        if not self.alias:
            key = f"{self.op}({metric_name})" if self.op is not None else metric_name
            object.__setattr__(self, "alias", key)

    def __str__(self) -> str:
        metric_name = get_public_name_from_mri(self.metric_mri)
        return f"{self.op}({metric_name})" if self.op else metric_name

    def __eq__(self, other: object) -> bool:
        # The equal method is called after the hash method to verify for equality of objects to insert
        # into the set. Because by default "__eq__()" does use the "is" operator we want to override it and
        # model MetricField's equivalence as having the same hash value, in order to reuse the comparison logic defined
        # in the "__hash__()" method.
        return bool(self.__hash__() == other.__hash__())

    def __hash__(self) -> int:
        hashable_list = []
        if self.op is not None:
            hashable_list.append(self.op)
        hashable_list.append(self.metric_mri)
        if self.params is not None:
            hashable_list.append(
                ",".join(sorted(":".join((x, str(y))) for x, y in self.params.items()))
            )
        return hash(tuple(hashable_list))


@dataclass(frozen=True)
class MetricGroupByField:
    field: Union[str, MetricField]
    alias: Optional[str] = None

    def __post_init__(self) -> None:
        if not self.alias:
            if isinstance(self.field, str):
                alias = self.field
            else:
                assert self.field.alias is not None
                alias = self.field.alias
            object.__setattr__(self, "alias", alias)

    @property
    def name(self) -> str:
        if isinstance(self.field, str):
            return self.field
        if isinstance(self.field, MetricField):
            assert self.field.alias is not None
            return self.field.alias
        raise InvalidParams(f"Invalid groupBy field type: {self.field}")


@dataclass(frozen=True)
class MetricConditionField:
    """
    Modelled after snuba_sdk.conditions.Condition
    """

    lhs: MetricField
    op: Op
    rhs: Union[int, float, str]


Tag = str
Groupable = Union[Tag, Literal["project_id"]]


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
    # ToDo(ahmed): In the future, once we start parsing conditions, the only conditions that should be here should be
    #  instances of MetricConditionField
    where: Optional[Sequence[Union[BooleanCondition, Condition, MetricConditionField]]] = None
    groupby: Optional[Sequence[MetricGroupByField]] = None
    orderby: Optional[Sequence[OrderBy]] = None
    limit: Optional[Limit] = None
    offset: Optional[Offset] = None
    include_totals: bool = True
    include_series: bool = True
    interval: Optional[int] = None

    @cached_property
    def projects(self) -> QuerySet:
        return Project.objects.filter(id__in=self.project_ids)

    @cached_property
    def use_case_key(self) -> UseCaseKey:
        return self._use_case_id(self.select[0].metric_mri)

    @staticmethod
    def _use_case_id(metric_mri: str) -> UseCaseKey:
        """Find correct use_case_id based on metric_name"""
        parsed_mri = parse_mri(metric_mri)
        assert parsed_mri is not None

        if parsed_mri.namespace == "transactions":
            return UseCaseKey.PERFORMANCE
        elif parsed_mri.namespace == "sessions":
            return UseCaseKey.RELEASE_HEALTH
        raise ValueError("Can't find correct use_case_id based on metric MRI")

    @staticmethod
    def _validate_field(field: MetricField) -> None:
        derived_metrics_mri = get_derived_metrics(exclude_private=True)

        # Validate the validity of the expression meaning that if an operation is present, then it needs to be one of
        # of the supported operations and that the metric mri should be one of the aggregated derived metrics
        if field.op:
            if field.op not in OPERATIONS:
                raise InvalidParams(
                    f"Invalid operation '{field.op}'. Must be one of {', '.join(OPERATIONS)}"
                )
            if field.metric_mri in derived_metrics_mri:
                raise DerivedMetricParseException(
                    f"Failed to parse {field.op}({get_public_name_from_mri(field.metric_mri)}). No operations can be "
                    f"applied on this field as it is already a derived metric with an "
                    f"aggregation applied to it."
                )

    def validate_select(self) -> None:
        if len(self.select) == 0:
            raise InvalidParams('Request is missing a "field"')
        use_case_ids = set()
        for field in self.select:
            use_case_ids.add(self._use_case_id(field.metric_mri))
            self._validate_field(field)
        if len(use_case_ids) > 1:
            raise InvalidParams("All select fields should have the same use_case_id")

    def validate_where(self) -> None:
        if not self.where:
            return
        for condition in self.where:
            if (
                isinstance(condition, Condition)
                and isinstance(condition.lhs, Column)
                and condition.lhs.name in UNALLOWED_TAGS
            ):
                raise InvalidParams(f"Tag name {condition.lhs.name} is not a valid query filter")

    def validate_orderby(self) -> None:
        if not self.orderby:
            return

        for orderby in self.orderby:
            self._validate_field(orderby.field)

        orderby_fields: Set[MetricField] = set()
        metric_entities: Set[MetricField] = set()
        for f in self.orderby:
            orderby_fields.add(f.field)

            # Construct a metrics expression
            metric_field_obj = metric_object_factory(f.field.op, f.field.metric_mri)

            use_case_id = self._use_case_id(f.field.metric_mri)
            entity = metric_field_obj.get_entity(self.projects, use_case_id)

            if isinstance(entity, Mapping):
                metric_entities.update(entity.keys())
            else:
                metric_entities.add(entity)
        # If metric entities set contains more than 1 metric, we can't orderBy these fields
        if len(metric_entities) > 1:
            raise InvalidParams("Selected 'orderBy' columns must belongs to the same entity")

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
        for metric_groupby_obj in self.groupby:
            if (
                isinstance(metric_groupby_obj.field, str)
                and metric_groupby_obj.field in UNALLOWED_TAGS
            ):
                raise InvalidParams(
                    f"Tag name {metric_groupby_obj.field} cannot be used in groupBy query"
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
        # Logic specific to how we handle time series in discover in terms of granularity and interval
        if (
            self.use_case_key == UseCaseKey.PERFORMANCE
            and self.include_series
            and self.interval is not None
        ):
            if self.granularity.granularity > self.interval:
                # If granularity is greater than interval, then we try to set granularity to the smallest allowed
                # granularity smaller than that interval
                # Copied from: sentry/search/events/builder.py::TimeseriesMetricQueryBuilder.__init__()
                for granularity in METRICS_LAYER_GRANULARITIES:
                    if granularity < self.interval:
                        object.__setattr__(self, "granularity", Granularity(granularity))
                        break

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

    def validate_interval(self) -> None:
        if self.interval is not None:
            if self.use_case_key == UseCaseKey.RELEASE_HEALTH or (
                self.use_case_key == UseCaseKey.PERFORMANCE and not self.include_series
            ):
                raise InvalidParams("Interval is only supported for timeseries performance queries")

    def __post_init__(self) -> None:
        super().__post_init__()

        if self.limit is None:
            # Cannot set attribute directly because dataclass is frozen:
            # https://docs.python.org/3/library/dataclasses.html#frozen-instances
            object.__setattr__(self, "limit", Limit(self.get_default_limit()))

        if (
            self.use_case_key == UseCaseKey.PERFORMANCE
            and self.include_series
            and self.interval is None
        ):
            object.__setattr__(self, "interval", self.granularity.granularity)
