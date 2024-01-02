from collections import namedtuple
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping, Optional, Sequence, Union

from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import BooleanCondition, Condition
from snuba_sdk.entity import Entity
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import OrderBy
from typing_extensions import NotRequired, TypedDict

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.services.hybrid_cloud.user import RpcUser

WhereType = Union[Condition, BooleanCondition]
# Replaced by SnubaParams
ParamsType = Mapping[str, Union[Sequence[int], int, str, datetime]]
SelectType = Union[AliasedExpression, Column, Function, CurriedFunction]

NormalizedArg = Optional[Union[str, float]]
HistogramParams = namedtuple(
    "HistogramParams", ["num_buckets", "bucket_size", "start_offset", "multiplier"]
)
# converter is to convert the aggregate filter to snuba query
Alias = namedtuple("Alias", "converter aggregate resolved_function")


@dataclass
class QueryFramework:
    orderby: List[OrderBy]
    having: List[WhereType]
    functions: List[CurriedFunction]
    entity: Entity


class EventsMeta(TypedDict):
    fields: Dict[str, str]
    tips: Dict[str, str]
    isMetricsData: NotRequired[bool]


class EventsResponse(TypedDict):
    data: List[Dict[str, Any]]
    meta: EventsMeta


@dataclass
class SnubaParams:
    start: Optional[datetime]
    end: Optional[datetime]
    # The None value in this sequence is because the filter params could include that
    environments: Sequence[Union[Environment, None]]
    projects: Sequence[Project]
    user: Optional[RpcUser]
    teams: Sequence[Team]
    organization: Optional[Organization]

    def __post_init__(self) -> None:
        if self.start:
            self.start = self.start.replace(tzinfo=timezone.utc)
        if self.end:
            self.end = self.end.replace(tzinfo=timezone.utc)

        # Only used in the trend query builder
        self.aliases: Optional[Dict[str, Alias]] = {}

    @property
    def environment_names(self) -> Sequence[str]:
        return (
            [env.name if env is not None else "" for env in self.environments]
            if self.environments
            else []
        )

    @property
    def project_ids(self) -> Sequence[int]:
        return sorted([proj.id for proj in self.projects])

    @property
    def project_slug_map(self) -> Mapping[str, int]:
        return {proj.slug: proj.id for proj in self.projects}

    @property
    def project_id_map(self) -> Mapping[int, str]:
        return {proj.id: proj.slug for proj in self.projects}

    @property
    def team_ids(self) -> Sequence[int]:
        return [team.id for team in self.teams]

    @property
    def interval(self) -> Optional[float]:
        if self.start and self.end:
            return (self.end - self.start).total_seconds()
        return None


@dataclass
class QueryBuilderConfig:
    auto_fields: bool = False
    auto_aggregations: bool = False
    use_aggregate_conditions: bool = False
    functions_acl: Optional[List[str]] = None
    equation_config: Optional[Dict[str, bool]] = None
    # This allows queries to be resolved without adding time constraints. Currently this is just
    # used to allow metric alerts to be built and validated before creation in snuba.
    skip_time_conditions: bool = False
    parser_config_overrides: Optional[Mapping[str, Any]] = None
    has_metrics: bool = False
    transform_alias_to_input_format: bool = False
    use_metrics_layer: bool = False
    # This skips converting tags back to their non-prefixed versions when processing the results
    # Currently this is only used for avoiding conflicting values when doing the first query
    # of a top events request
    skip_tag_resolution: bool = False
    on_demand_metrics_enabled: bool = False
    on_demand_metrics_type: Optional[Any] = None
    skip_field_validation_for_entity_subscription_deletion: bool = False
    allow_metric_aggregates: Optional[bool] = False
