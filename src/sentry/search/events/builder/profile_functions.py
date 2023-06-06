from typing import Optional, Protocol

from snuba_sdk import Column
from snuba_sdk.function import Function

from sentry.search.events.builder import QueryBuilder, TimeseriesQueryBuilder
from sentry.search.events.datasets.profile_functions import ProfileFunctionsDatasetConfig
from sentry.search.events.types import SelectType, SnubaParams


class ProfileFunctionsQueryBuilderProtocol(Protocol):
    @property
    def config(self) -> ProfileFunctionsDatasetConfig:
        ...

    @property
    def params(self) -> SnubaParams:
        ...

    def column(self, name: str) -> Column:
        ...


class ProfileFunctionsQueryBuilderMixin:
    def resolve_column_name(self: ProfileFunctionsQueryBuilderProtocol, col: str) -> str:
        # giving resolved a type here convinces mypy that the type is str
        resolved: str = self.config.resolve_column(col)
        return resolved

    def get_field_type(self: ProfileFunctionsQueryBuilderProtocol, field: str) -> Optional[str]:
        # giving resolved a type here convinces mypy that the type is str
        resolved: Optional[str] = self.config.resolve_column_type(field)
        return resolved


class ProfileFunctionsQueryBuilder(ProfileFunctionsQueryBuilderMixin, QueryBuilder):
    pass


class ProfileFunctionsTimeseriesQueryBuilder(
    ProfileFunctionsQueryBuilderMixin, TimeseriesQueryBuilder
):
    @property
    def time_column(self) -> SelectType:
        return Function(
            "toDateTime",
            [
                Function(
                    "multiply",
                    [
                        Function(
                            "intDiv",
                            [
                                Function("toUInt32", [Column("timestamp")]),
                                self.interval,
                            ],
                        ),
                        self.interval,
                    ],
                ),
            ],
            "time",
        )
