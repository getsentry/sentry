from typing import Callable, Mapping, Optional

from snuba_sdk import Function, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.constants import (
    RELEASE_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.search.events.datasets import filter_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import SessionColumnArg, SnQLFunction
from sentry.search.events.types import SelectType, WhereType


class SessionsDatasetConfig(DatasetConfig):
    non_nullable_keys = {"project", "project_id", "environment", "release"}

    def __init__(self, builder: QueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {
            RELEASE_ALIAS: self._release_filter_converter,
            RELEASE_STAGE_ALIAS: self._release_stage_filter_converter,
            SEMVER_ALIAS: self._semver_filter_converter,
            SEMVER_PACKAGE_ALIAS: self._semver_package_filter_converter,
            SEMVER_BUILD_ALIAS: self._semver_build_filter_converter,
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {}

    @property
    def function_converter(self) -> Mapping[str, SnQLFunction]:
        return {
            function.name: function
            for function in [
                SnQLFunction(
                    "percentage",
                    required_args=[SessionColumnArg("numerator"), SessionColumnArg("denominator")],
                    # Since percentage is only used on aggregates, it needs to be an aggregate and not a column
                    # This is because as a column it will be added to the `WHERE` clause instead of the `HAVING` clause
                    snql_aggregate=lambda args, alias: Function(
                        "if",
                        parameters=[
                            Function("greater", parameters=[args["denominator"], 0]),
                            Function("divide", parameters=[args["numerator"], args["denominator"]]),
                            None,
                        ],
                        alias=alias,
                    ),
                    default_result_type="percentage",
                ),
                SnQLFunction(
                    "identity",
                    required_args=[SessionColumnArg("column")],
                    snql_aggregate=lambda args, alias: Function(
                        "identity", parameters=[args["column"]], alias=alias
                    ),
                ),
            ]
        }

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {}

    def _release_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.release_filter_converter(self.builder, search_filter)

    def _release_stage_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.release_stage_filter_converter(self.builder, search_filter)

    def _semver_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.semver_filter_converter(self.builder, search_filter)

    def _semver_package_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.semver_package_filter_converter(self.builder, search_filter)

    def _semver_build_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.semver_build_filter_converter(self.builder, search_filter)
