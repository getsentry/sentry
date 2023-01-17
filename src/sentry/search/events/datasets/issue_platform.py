from typing import Callable, Mapping, Optional

from snuba_sdk import Direction, Function, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.search.events import builder
from sentry.search.events.constants import USER_DISPLAY_ALIAS
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import SnQLFunction
from sentry.search.events.types import SelectType, WhereType


class IssuePlatformDatasetConfig(DatasetConfig):
    def __init__(self, builder: builder):  # can't get builder.QueryBuilder due to import issue
        self.builder = builder

    def _resolve_user_display_alias(self, _: str) -> SelectType:
        columns = ["user_email", "user_name", "user_id", "ip_address_v4"]
        return Function(
            "coalesce", [self.builder.column(column) for column in columns], USER_DISPLAY_ALIAS
        )

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            USER_DISPLAY_ALIAS: self._resolve_user_display_alias,
        }

    def _user_display_orderby_converter(self, direction: Direction) -> OrderBy:
        return {}  # TODO rewrite for user display

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {
            USER_DISPLAY_ALIAS: self._user_display_orderby_converter,
        }

    def _user_display_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        pass  # TODO rewrite for user display
        # return filter_aliases.project_slug_converter(self.builder, search_filter)

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {
            USER_DISPLAY_ALIAS: self._user_display_filter_converter,
        }

    @property
    def function_converter(self) -> Mapping[str, SnQLFunction]:
        return {
            function.name: function
            for function in [
                SnQLFunction(
                    "user_email",
                    snql_aggregate=lambda _, alias: Function(
                        "max",
                        [self.builder.column("timestamp")],
                        alias,
                    ),
                    default_result_type="string",
                ),
                SnQLFunction(
                    "user_name",
                    snql_aggregate=lambda _, alias: Function(
                        "argMax",
                        [self.builder.column("timestamp")],
                        alias,
                    ),
                    default_result_type="string",
                ),
                SnQLFunction(
                    "user_id",
                    snql_aggregate=lambda _, alias: Function(
                        "max",
                        [self.builder.column("timestamp")],
                        alias,
                    ),
                    default_result_type="string",
                ),
                SnQLFunction(
                    "ip_address_v4",
                    snql_aggregate=lambda _, alias: Function(
                        ",max",
                        [self.builder.column("timestamp")],
                        alias,
                    ),
                    default_result_type="string",
                ),
            ]
        }
