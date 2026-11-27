from __future__ import annotations

from collections.abc import Callable, Mapping

from snuba_sdk import Column, Function, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery
from sentry.search.events import constants, fields
from sentry.search.events.builder import metrics
from sentry.search.events.datasets import field_aliases, filter_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.types import SelectType, WhereType


class MetricsDatasetConfig(DatasetConfig):
    missing_function_error = IncompatibleMetricsQuery

    def __init__(self, builder: metrics.MetricsQueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(self) -> Mapping[str, Callable[[SearchFilter], WhereType | None]]:
        return {
            constants.PROJECT_ALIAS: lambda search_filter: filter_aliases.project_slug_converter(
                self.builder, search_filter
            ),
            constants.PROJECT_NAME_ALIAS: lambda search_filter: filter_aliases.project_slug_converter(
                self.builder, search_filter
            ),
            constants.RELEASE_ALIAS: lambda search_filter: filter_aliases.release_filter_converter(
                self.builder, search_filter
            ),
            "environment": self.builder._environment_filter_converter,
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            constants.PROJECT_ALIAS: lambda alias: field_aliases.resolve_project_slug_alias(
                self.builder, alias
            ),
            constants.PROJECT_NAME_ALIAS: lambda alias: field_aliases.resolve_project_slug_alias(
                self.builder, alias
            ),
        }

    @property
    def function_converter(self) -> Mapping[str, fields.MetricsFunction]:
        return {
            function.name: function
            for function in [
                fields.MetricsFunction(
                    "sumIf",
                    required_args=[
                        fields.ColumnTagArg("if_col"),
                        fields.FunctionArg("if_val"),
                    ],
                    calculated_args=[
                        {
                            "name": "resolved_val",
                            "fn": lambda args: self.builder.resolve_tag_value(args["if_val"]),
                        }
                    ],
                    snql_counter=lambda args, alias: Function(
                        "sumIf",
                        [
                            Column("value"),
                            Function("equals", [args["if_col"], args["resolved_val"]]),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                fields.MetricsFunction(
                    "uniq",
                    snql_set=lambda args, alias: Function(
                        "uniq",
                        [Column("value")],
                        alias,
                    ),
                ),
                fields.MetricsFunction(
                    "uniqIf",
                    required_args=[
                        fields.ColumnTagArg("if_col"),
                        fields.FunctionArg("if_val"),
                    ],
                    calculated_args=[
                        {
                            "name": "resolved_val",
                            "fn": lambda args: self.builder.resolve_tag_value(args["if_val"]),
                        }
                    ],
                    snql_set=lambda args, alias: Function(
                        "uniqIf",
                        [
                            Column("value"),
                            Function("equals", [args["if_col"], args["resolved_val"]]),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
            ]
        }

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {}
