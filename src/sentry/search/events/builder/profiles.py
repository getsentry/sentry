from typing import Optional, Protocol

from snuba_sdk import Column

from sentry.search.events.builder import QueryBuilder, TimeseriesQueryBuilder
from sentry.search.events.datasets.profiles import ProfilesDatasetConfig
from sentry.search.events.types import SnubaParams


class ProfilesQueryBuilderProtocol(Protocol):
    @property
    def config(self) -> ProfilesDatasetConfig:
        ...

    @property
    def params(self) -> SnubaParams:
        ...

    def column(self, name: str) -> Column:
        ...


class ProfilesQueryBuilderMixin:
    requires_organization_condition: bool = True
    organization_column: str = "organization.id"

    def resolve_column_name(self: ProfilesQueryBuilderProtocol, col: str) -> str:
        # giving resolved a type here convinces mypy that the type is str
        resolved: str = self.config.resolve_column(col)
        return resolved

    def get_field_type(self: ProfilesQueryBuilderProtocol, field: str) -> Optional[str]:
        # giving resolved a type here convinces mypy that the type is str
        resolved: Optional[str] = self.config.resolve_column_type(field)
        return resolved


class ProfilesQueryBuilder(ProfilesQueryBuilderMixin, QueryBuilder):
    pass


class ProfilesTimeseriesQueryBuilder(ProfilesQueryBuilderMixin, TimeseriesQueryBuilder):
    pass
