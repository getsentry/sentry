from typing import Callable, Mapping, Optional

from snuba_sdk import Function

from sentry.api.event_search import SearchFilter
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.constants import RELEASE_ALIAS
from sentry.search.events.datasets import filter_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import SessionColumnArg, SnQLFunction
from sentry.search.events.types import SelectType, WhereType


class SessionsDatasetConfig(DatasetConfig):
    def __init__(self, builder: QueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {
            RELEASE_ALIAS: self._release_filter_converter,
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

    def _release_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        return filter_aliases.release_filter_converter(self.builder, search_filter)
