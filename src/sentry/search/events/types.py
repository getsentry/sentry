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

from sentry.models import Environment, Organization, Project, Team, User

WhereType = Union[Condition, BooleanCondition]
# TODO: this should be a dataclass instead
ParamsType = Mapping[str, Union[List[int], int, str, datetime]]
SelectType = Union[AliasedExpression, Column, Function, CurriedFunction]

NormalizedArg = Optional[Union[str, float]]
HistogramParams = namedtuple(
    "HistogramParams", ["num_buckets", "bucket_size", "start_offset", "multiplier"]
)


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
    environments: Sequence[Environment]
    projects: Sequence[Project]
    user: Optional[User]
    teams: Sequence[Team]
    organization: Organization

    def __post_init__(self) -> None:
        if self.start:
            self.start = self.start.replace(tzinfo=timezone.utc)
        if self.end:
            self.end = self.end.replace(tzinfo=timezone.utc)

    @property
    def environment_names(self) -> Sequence[str]:
        return [env.name for env in self.environments] if self.environments else []

    @property
    def project_ids(self) -> Sequence[int]:
        return [proj.id for proj in self.projects]

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
