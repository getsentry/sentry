from typing import Optional, Protocol

from snuba_sdk import Column

from sentry.search.events.builder import QueryBuilder, TimeseriesQueryBuilder
from sentry.search.events.datasets.functions import FunctionsDatasetConfig
from sentry.search.events.types import SnubaParams


class FunctionsQueryBuilderProtocol(Protocol):
    @property
    def config(self) -> FunctionsDatasetConfig:
        ...

    @property
    def params(self) -> SnubaParams:
        ...

    def column(self, name: str) -> Column:
        ...


class FunctionsQueryBuilderMixin:
    f: bool = False

    def resolve_column_name(self: FunctionsQueryBuilderProtocol, col: str) -> str:
        # giving resolved a type here convinces mypy that the type is str
        resolved: str = self.config.resolve_column(col)
        return resolved

    def get_field_type(self: FunctionsQueryBuilderProtocol, field: str) -> Optional[str]:
        # giving resolved a type here convinces mypy that the type is str
        resolved: Optional[str] = self.config.resolve_column_type(field)
        return resolved


class FunctionsQueryBuilder(FunctionsQueryBuilderMixin, QueryBuilder):
    pass


class FunctionsTimeseriesQueryBuilder(FunctionsQueryBuilderMixin, TimeseriesQueryBuilder):
    pass
