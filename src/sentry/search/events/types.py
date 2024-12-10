from __future__ import annotations

from collections import namedtuple
from collections.abc import Iterable, Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, NotRequired, Optional, TypedDict, Union

from django.utils import timezone as django_timezone
from google.protobuf.timestamp_pb2 import Timestamp
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import BooleanCondition, Condition
from snuba_sdk.entity import Entity
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import OrderBy

from sentry.exceptions import InvalidSearchQuery
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.users.services.user import RpcUser
from sentry.utils.validators import INVALID_SPAN_ID, is_span_id

WhereType = Union[Condition, BooleanCondition]


# Replaced by SnubaParams
class ParamsType(TypedDict, total=False):
    project_id: list[int]
    projects: list[Project]
    project_objects: list[Project]
    start: datetime
    end: datetime
    environment: NotRequired[str | list[str]]
    organization_id: NotRequired[int]
    use_case_id: NotRequired[str]
    team_id: NotRequired[list[int]]
    environment_objects: NotRequired[list[Environment]]
    statsPeriod: NotRequired[str]


SelectType = Union[AliasedExpression, Column, Function, CurriedFunction]

NormalizedArg = Optional[Union[str, float]]
HistogramParams = namedtuple(
    "HistogramParams", ["num_buckets", "bucket_size", "start_offset", "multiplier"]
)
# converter is to convert the aggregate filter to snuba query
Alias = namedtuple("Alias", "converter aggregate resolved_function")


@dataclass
class QueryFramework:
    orderby: list[OrderBy]
    having: list[WhereType]
    functions: list[CurriedFunction]
    entity: Entity


SnubaRow = dict[str, Any]
SnubaData = list[SnubaRow]


class EventsMeta(TypedDict):
    fields: dict[str, str]
    tips: NotRequired[dict[str, str | None]]
    isMetricsData: NotRequired[bool]


class EventsResponse(TypedDict):
    data: SnubaData
    meta: EventsMeta


@dataclass
class SnubaParams:
    start: datetime | None = None
    end: datetime | None = None
    stats_period: str | None = None
    # The None value in this sequence is because the filter params could include that
    environments: Sequence[Environment | None] = field(default_factory=list)
    projects: Sequence[Project] = field(default_factory=list)
    user: RpcUser | None = None
    teams: Iterable[Team] = field(default_factory=list)
    organization: Organization | None = None

    def __post_init__(self) -> None:
        if self.start:
            self.start = self.start.replace(tzinfo=timezone.utc)
        if self.end:
            self.end = self.end.replace(tzinfo=timezone.utc)
        if self.start is None and self.end is None:
            self.parse_stats_period()
        if self.organization is None and len(self.projects) > 0:
            self.organization = self.projects[0].organization

        # Only used in the trend query builder
        self.aliases: dict[str, Alias] | None = {}

    def parse_stats_period(self) -> None:
        if self.stats_period is not None:
            self.end = django_timezone.now()
            from sentry.api.utils import get_datetime_from_stats_period

            self.start = get_datetime_from_stats_period(self.stats_period, self.end)

    @property
    def start_date(self) -> datetime:
        # This and end_date are helper functions so callers don't have to check if either are defined for typing
        if self.start is None:
            raise InvalidSearchQuery("start is required")
        return self.start

    @property
    def rpc_start_date(self) -> Timestamp:
        timestamp = Timestamp()
        timestamp.FromDatetime(self.start_date)
        return timestamp

    @property
    def end_date(self) -> datetime:
        if self.end is None:
            raise InvalidSearchQuery("end is required")
        return self.end

    @property
    def rpc_end_date(self) -> Timestamp:
        timestamp = Timestamp()
        timestamp.FromDatetime(self.end_date)
        return timestamp

    @property
    def date_range(self) -> timedelta:
        return self.end_date - self.start_date

    @property
    def environment_names(self) -> list[str]:
        return (
            [env.name if env is not None else "" for env in self.environments]
            if self.environments
            else []
        )

    @property
    def environment_ids(self) -> list[int]:
        return (
            [env.id for env in self.environments if env is not None and env.id is not None]
            if self.environments
            else []
        )

    @property
    def project_ids(self) -> list[int]:
        # proj.id can be None if the project no longer exists
        return sorted([proj.id for proj in self.projects if proj.id is not None])

    @property
    def project_slug_map(self) -> dict[str, int]:
        return {proj.slug: proj.id for proj in self.projects}

    @property
    def project_id_map(self) -> dict[int, str]:
        return {proj.id: proj.slug for proj in self.projects}

    @property
    def team_ids(self) -> list[int]:
        return [team.id for team in self.teams]

    @property
    def interval(self) -> float | None:
        if self.start and self.end:
            return (self.end - self.start).total_seconds()
        return None

    @property
    def organization_id(self) -> int | None:
        if self.organization is not None:
            return self.organization.id
        return None

    @property
    def filter_params(self) -> ParamsType:
        # Compatibility function so we can switch over to this dataclass more easily
        filter_params: ParamsType = {
            "project_id": list(self.project_ids),
            "projects": list(self.projects),
            "project_objects": list(self.projects),
            "environment": list(self.environment_names),
            "team_id": list(self.team_ids),
            "environment_objects": (
                [env for env in self.environments if env is not None] if self.environments else []
            ),
        }
        if self.organization_id:
            filter_params["organization_id"] = self.organization_id
        if self.start:
            filter_params["start"] = self.start
        if self.end:
            filter_params["end"] = self.end
        if self.stats_period:
            filter_params["statsPeriod"] = self.stats_period
        return filter_params

    def copy(self) -> SnubaParams:
        return deepcopy(self)


@dataclass
class QueryBuilderConfig:
    auto_fields: bool = False
    auto_aggregations: bool = False
    use_aggregate_conditions: bool = False
    functions_acl: list[str] | None = None
    equation_config: dict[str, bool] | None = None
    # This allows queries to be resolved without adding time constraints. Currently this is just
    # used to allow metric alerts to be built and validated before creation in snuba.
    skip_time_conditions: bool = False
    parser_config_overrides: Mapping[str, Any] | None = None
    has_metrics: bool = False
    transform_alias_to_input_format: bool = False
    use_metrics_layer: bool = False
    # This skips converting tags back to their non-prefixed versions when processing the results
    # Currently this is only used for avoiding conflicting values when doing the first query
    # of a top events request
    skip_tag_resolution: bool = False
    on_demand_metrics_enabled: bool = False
    on_demand_metrics_type: Any | None = None
    skip_field_validation_for_entity_subscription_deletion: bool = False
    allow_metric_aggregates: bool | None = False
    insights_metrics_override_metric_layer: bool = False
    # Allow the errors query builder to use the entity prefix for fields
    use_entity_prefix_for_fields: bool = False


@dataclass(frozen=True)
class Span:
    op: str
    group: str

    @staticmethod
    def from_str(s: str) -> Span:
        parts = s.rsplit(":", 1)
        if len(parts) != 2:
            raise ValueError(
                "span must consist of of a span op and a valid 16 character hex delimited by a colon (:)"
            )
        if not is_span_id(parts[1]):
            raise ValueError(INVALID_SPAN_ID.format("spanGroup"))
        return Span(op=parts[0], group=parts[1])
