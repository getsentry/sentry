from typing import Protocol

from snuba_sdk import Column

from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.discover import TimeseriesQueryBuilder
from sentry.search.events.datasets.profiles import ProfilesDatasetConfig
from sentry.search.events.types import SnubaParams


class ProfilesQueryBuilderProtocol(Protocol):
    @property
    def config(self) -> ProfilesDatasetConfig: ...

    @property
    def params(self) -> SnubaParams: ...

    def column(self, name: str) -> Column: ...


class ProfilesQueryBuilderMixin:
    requires_organization_condition: bool = True
    organization_column: str = "organization.id"

    def resolve_column_name(self: ProfilesQueryBuilderProtocol, col: str) -> str:
        # giving resolved a type here convinces mypy that the type is str
        resolved: str = self.config.resolve_column(col)
        return resolved

    def get_field_type(self: ProfilesQueryBuilderProtocol, field: str) -> str | None:
        # giving resolved a type here convinces mypy that the type is str
        resolved: str | None = self.config.resolve_column_type(field)
        return resolved


class ProfilesQueryBuilder(ProfilesQueryBuilderMixin, BaseQueryBuilder):
    config_class = ProfilesDatasetConfig


class ProfilesTimeseriesQueryBuilder(ProfilesQueryBuilderMixin, TimeseriesQueryBuilder):
    config_class = ProfilesDatasetConfig
