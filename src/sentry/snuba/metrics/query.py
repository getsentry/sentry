""" Classes needed to build a metrics query. Inspired by snuba_sdk.query. """

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import cached_property
from typing import Literal, Union

from django.db.models import QuerySet
from snuba_sdk import Column, Direction, Granularity, Limit, Offset, Op
from snuba_sdk.conditions import BooleanCondition, Condition, ConditionGroup

from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.fields import metric_object_factory
from sentry.snuba.metrics.fields.base import get_derived_metrics
from sentry.snuba.metrics.naming_layer.mri import parse_mri

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
    MetricEntity,
    MetricOperationType,
    get_num_intervals,
)


@dataclass(frozen=True)
class MetricField:
    op: MetricOperationType | None
    metric_mri: str
    params: dict[str, None | str | int | float | Sequence[tuple[str | int, ...]]] | None = None
    alias: str | None = None

    def __post_init__(self) -> None:
        # Validate that it is a valid MRI format
        parsed_mri = parse_mri(self.metric_mri)
        if parsed_mri is None:
            raise InvalidParams(f"Invalid Metric MRI: {self.metric_mri}")

        # We compute the metric name before the alias, since we want to make sure it's a public facing metric.
        metric_name = self._metric_name
        if not self.alias:
            key = f"{self.op}({metric_name})" if self.op is not None else metric_name
            object.__setattr__(self, "alias", key)

    @property
    def _metric_name(self) -> str:
        return get_public_name_from_mri(self.metric_mri)

    def __str__(self) -> str:
        return f"{self.op}({self._metric_name})" if self.op else self._metric_name

    def __eq__(self, other: object) -> bool:
        # The equal method is called after the hash method to verify for equality of objects to insert
        # into the set. Because by default "__eq__()" does use the "is" operator we want to override it and
        # model MetricField's equivalence as having the same hash value, in order to reuse the comparison logic defined
        # in the "__hash__()" method.
        return bool(self.__hash__() == other.__hash__())

    def __hash__(self) -> int:
        hashable_list: list[MetricOperationType | str] = []
        if self.op is not None:
            hashable_list.append(self.op)
        hashable_list.append(self.metric_mri)
        if self.params is not None:
            hashable_list.append(
                ",".join(sorted(":".join((x, str(y))) for x, y in self.params.items()))
            )
        return hash(tuple(hashable_list))


@dataclass(frozen=True)
class MetricActionByField:
    field: str | MetricField


@dataclass(frozen=True)
class MetricGroupByField(MetricActionByField):
    alias: str | None = None

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
class MetricOrderByField(MetricActionByField):
    direction: Direction = Direction.ASC


@dataclass(frozen=True)
class MetricConditionField:
    """
    Modelled after snuba_sdk.conditions.Condition
    """

    lhs: MetricField
    op: Op
    rhs: int | float | str


Groupable = Union[str, Literal["project_id"]]


class MetricsQueryValidationRunner:
    def __post_init__(self) -> None:
        """Run validation methods if declared.
        The validation method can be a simple check
        that raises ValueError or a transformation to
        the field value.
        The validation is performed by calling a function named:
            `validate_<field_name>(self) -> None`
        """
        for name, _ in self.__dataclass_fields__.items():  # type: ignore[attr-defined]
            if method := getattr(self, f"validate_{name}", None):
                method()


@dataclass(frozen=True)
class DeprecatingMetricsQuery(MetricsQueryValidationRunner):
    """
    Snuba provides a new language called MQL which has been designed to replace the old metrics language.
    We intend to deprecate the old metrics language in the future. For any new features, we recommend using MQL.
    Documentation of MQL can be found at https://getsentry.github.io/snuba/language/mql.html and
    https://getsentry.github.io/snuba-sdk/snuba_sdk.html#MetricsQuery

    Definition of a metrics query, inspired by snuba_sdk.Query
    """

    org_id: int
    project_ids: Sequence[int]
    select: Sequence[MetricField]
    granularity: Granularity
    # ToDo(ahmed): In the future, once we start parsing conditions, the only conditions that should be here should be
    #  instances of MetricConditionField
    start: datetime | None = None
    end: datetime | None = None
    where: Sequence[BooleanCondition | Condition | MetricConditionField] | None = None
    having: ConditionGroup | None = None
    groupby: Sequence[MetricGroupByField] | None = None
    orderby: Sequence[MetricOrderByField] | None = None
    limit: Limit | None = None
    # In cases where limit involves calculation (eg. top N series), we want to cap the limit since it'll be blocked otherwise.
    max_limit: Limit | None = None
    offset: Offset | None = None
    include_totals: bool = True
    include_series: bool = True
    interval: int | None = None
    # This field is used as a temporary fix to allow the metrics layer to support alerts by generating snql that
    # doesn't take into account time bounds as the alerts service uses subscriptable queries that react in real time
    # to dataset changes.
    is_alerts_query: bool = False
    # Need to skip the orderby validation for ondemand queries, this is because ondemand fields are based on a spec
    # instead of being direct fields
    skip_orderby_validation: bool = False

    @cached_property
    def projects(self) -> QuerySet[Project]:
        return Project.objects.filter(id__in=self.project_ids)

    @cached_property
    def use_case_id(self) -> UseCaseID:
        return self._use_case_id(self.select[0].metric_mri)

    @staticmethod
    def _use_case_id(metric_mri: str) -> UseCaseID:
        """Find correct use_case_id based on metric_name"""
        parsed_mri = parse_mri(metric_mri)
        assert parsed_mri is not None
        try:
            return UseCaseID(parsed_mri.namespace)
        except ValueError:
            raise ValueError("Can't find correct use_case_id based on metric MRI")

    @staticmethod
    def _validate_field(field: MetricField) -> None:
        all_derived_metrics = get_derived_metrics()

        # Validate the validity of the expression meaning that if an operation is present, then it needs to be one of
        # of the supported operations and that the metric mri should be one of the aggregated derived metrics
        if field.op:
            if field.op not in OPERATIONS:
                raise InvalidParams(
                    f"Invalid operation '{field.op}'. Must be one of {', '.join(OPERATIONS)}"
                )
            if field.metric_mri in all_derived_metrics:
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
                # This is a special condition that holds only for the usage with alerts which requires the
                # session.status to be injected in the where clause for performance reasons. This condition should
                # be removed once we change how alerts uses the metrics layer.
                if not (condition.lhs.name == "session.status" and self.is_alerts_query):
                    raise InvalidParams(
                        f"Tag name {condition.lhs.name} is not a valid query filter"
                    )

    def validate_orderby(self) -> None:
        if not self.orderby or self.skip_orderby_validation:
            return

        for metric_order_by_field in self.orderby:
            # We filter all the fields that are strings because we don't require them for the order by validation and
            # if they contain invalid strings, they will be catched during the snql generation.
            if isinstance(metric_order_by_field.field, MetricField):
                self._validate_field(metric_order_by_field.field)

        orderby_metric_fields: set[MetricField] = set()
        metric_entities: set[MetricEntity | None] = set()
        group_by_str_fields: set[str] = self.action_by_str_fields(on_group_by=True)
        for metric_order_by_field in self.orderby:
            if isinstance(metric_order_by_field.field, MetricField):
                orderby_metric_fields.add(metric_order_by_field.field)

                # Construct a metrics expression
                metric_field_obj = metric_object_factory(
                    metric_order_by_field.field.op, metric_order_by_field.field.metric_mri
                )

                use_case_id = self._use_case_id(metric_order_by_field.field.metric_mri)
                entity = metric_field_obj.get_entity(self.projects, use_case_id)

                if isinstance(entity, Mapping):
                    metric_entities.update(entity.keys())
                else:
                    metric_entities.add(entity)
            elif isinstance(metric_order_by_field.field, str):
                if metric_order_by_field.field not in group_by_str_fields:
                    raise InvalidParams(
                        f"String field {metric_order_by_field.field} in the 'order by' must be also "
                        f"in the 'group by'"
                    )

        # If metric entities set contains more than 1 metric, we can't orderBy these fields
        if len(metric_entities) > 1:
            raise InvalidParams("Selected 'orderBy' columns must belongs to the same entity")

        # Validate all orderby columns are presented in provided 'fields'
        if set(self.select).issuperset(orderby_metric_fields):
            return

        raise InvalidParams("'orderBy' must be one of the provided 'fields'")

    def action_by_str_fields(self, on_group_by: bool) -> set[str]:
        action_by_str_fields: set[str] = set()

        for action_by_field in (self.groupby if on_group_by else self.orderby) or []:
            if isinstance(action_by_field.field, str):
                action_by_str_fields.add(action_by_field.field)

        return action_by_str_fields

    def validate_limit(self) -> None:
        if self.limit is None:
            return
        intervals_len = get_num_intervals(
            end=self.end,
            start=self.start,
            granularity=self.granularity.granularity,
            interval=self.interval,
        )
        if self.max_limit and self.max_limit < MAX_POINTS:
            return
        if self.limit.limit > MAX_POINTS:
            raise InvalidParams(
                f"Requested limit exceeds the maximum allowed limit of {MAX_POINTS}"
            )
        if self.start and self.end and self.include_series:
            if intervals_len * self.limit.limit > MAX_POINTS:
                raise InvalidParams(
                    f"Requested intervals ({intervals_len}) of timedelta of "
                    f"{timedelta(seconds=self.granularity.granularity)} with statsPeriod "
                    f"timedelta of {self.end - self.start} is too granular for a per_page of "
                    f"{self.limit.limit} elements. Increase your interval, decrease your "
                    f"statsPeriod, or decrease your per_page parameter."
                )

    def validate_groupby(self) -> None:
        if not self.groupby:
            return

        for group_by_field in self.groupby:
            if isinstance(group_by_field.field, str) and group_by_field.field in UNALLOWED_TAGS:
                raise InvalidParams(
                    f"Tag name {group_by_field.field} cannot be used in groupBy query"
                )

    def validate_include_totals(self) -> None:
        if self.include_totals or self.include_series:
            return
        raise InvalidParams("Cannot omit both series and totals")

    def get_default_limit(self) -> int:
        totals_limit: int = MAX_POINTS
        if self.start and self.end and self.include_series:
            intervals_len = get_num_intervals(
                start=self.start,
                end=self.end,
                granularity=self.granularity.granularity,
                interval=self.interval,
            )
            # In a series query, we also need to factor in the len of the intervals
            # array. The number of totals should never get so large that the
            # intervals exceed MAX_POINTS, however at least a single group.
            totals_limit = max(totals_limit // intervals_len, 1)
        return totals_limit

    def validate_end(self) -> None:
        if self.start and self.end and self.start >= self.end:
            raise InvalidParams("start must be before end")

    def validate_granularity(self) -> None:
        # Logic specific to how we handle time series in discover in terms of granularity and interval
        if (
            self.use_case_id == UseCaseID.TRANSACTIONS
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

        # see what's our effective interval (either the one passed in or the one from the granularity)
        if self.interval is None:
            interval = self.granularity.granularity
        else:
            interval = self.interval

        if self.start and self.end and self.include_series:
            # For this calculation, we decided to round down to the integer since if we get 10.000,x we prefer to allow
            # the query and lose some data points. On the other hand, if we get 11.000,x we will not allow the query.
            if int((self.end - self.start).total_seconds() / interval) > MAX_POINTS:
                raise InvalidParams(
                    "Your interval and date range would create too many results. "
                    "Use a larger interval, or a smaller date range."
                )

    def validate_interval(self) -> None:
        if self.interval is not None:
            if self.use_case_id is UseCaseID.SESSIONS or (
                self.use_case_id is UseCaseID.TRANSACTIONS and not self.include_series
            ):
                raise InvalidParams("Interval is only supported for timeseries performance queries")

    def validate_is_alerts_query(self) -> None:
        # We only allow the omission of start and end if this is an alerts query.
        if (self.start is None or self.end is None) and not self.is_alerts_query:
            raise InvalidParams(
                "start and env fields can only be None if the query is needed by alerts"
            )

    def __post_init__(self) -> None:
        super().__post_init__()

        # Only if we have a start and end date we want to use the limit.
        if self.start and self.end and self.limit is None:
            # Cannot set attribute directly because dataclass is frozen:
            # https://docs.python.org/3/library/dataclasses.html#frozen-instances
            object.__setattr__(self, "limit", Limit(self.get_default_limit()))

        if (
            self.use_case_id in [UseCaseID.TRANSACTIONS, UseCaseID.CUSTOM]
            and self.include_series
            and self.interval is None
        ):
            object.__setattr__(self, "interval", self.granularity.granularity)
