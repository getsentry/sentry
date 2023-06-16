from collections import namedtuple
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional, Sequence, Union

from django.utils import timezone
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import BooleanCondition, Condition
from snuba_sdk.entity import Entity
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import OrderBy
from typing_extensions import TypedDict

from sentry.models import Environment, Organization, Project, Team
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
