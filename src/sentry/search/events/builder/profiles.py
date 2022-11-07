from typing import List, Optional, Protocol

from snuba_sdk import Column, Condition, Op

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.builder import QueryBuilder, TimeseriesQueryBuilder
from sentry.search.events.datasets.profiles import ProfilesDatasetConfig
from sentry.search.events.types import SnubaParams, WhereType


class ProfilesQueryBuilderProtocol(Protocol):
    @property
    def config(self) -> ProfilesDatasetConfig:
        ...

    @property
    def params(self) -> SnubaParams:
        ...

    def column(self, name: str) -> Column:
        ...

    def resolve_params(self) -> List[WhereType]:
        ...


class ProfilesQueryBuilderMixin:
    def resolve_column_name(self: ProfilesQueryBuilderProtocol, col: str) -> str:
        # giving resolved a type here convinces mypy that the type is str
        resolved: str = self.config.resolve_column(col)
        return resolved

    def resolve_params(self: ProfilesQueryBuilderProtocol) -> List[WhereType]:
        if self.params.organization is None:
            raise InvalidSearchQuery("Organization is a required parameter")
        # not sure how to make mypy happy here as `super()`
        # refers to the other parent query builder class
        conditions: List[WhereType] = super().resolve_params()  # type: ignore

        # the profiles dataset requires a condition
        # on the organization_id in the query
        conditions.append(
            Condition(
                self.column("organization.id"),
                Op.EQ,
                self.params.organization.id,
            )
        )

        return conditions

    def get_field_type(self: ProfilesQueryBuilderProtocol, field: str) -> Optional[str]:
        # giving resolved a type here convinces mypy that the type is str
        resolved: Optional[str] = self.config.resolve_column_type(field)
        return resolved


class ProfilesQueryBuilder(ProfilesQueryBuilderMixin, QueryBuilder):
    pass


class ProfilesTimeseriesQueryBuilder(ProfilesQueryBuilderMixin, TimeseriesQueryBuilder):
    pass
