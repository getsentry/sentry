from __future__ import annotations

from collections.abc import Callable, Mapping

from snuba_sdk import And, Column, Condition, Direction, Function, Op, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.search.events import builder, constants
from sentry.search.events.datasets import field_aliases, filter_aliases, function_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import IntervalDefault, NumberRange, SnQLFunction, with_default
from sentry.search.events.types import SelectType, WhereType


class MetricsSummariesDatasetConfig(DatasetConfig):
    def __init__(self, builder: builder.QueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], WhereType | None]]:
        return {
            constants.PROJECT_ALIAS: self._project_slug_filter_converter,
            constants.PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
            "metric": self._metric_filter_converter,
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            constants.PROJECT_ALIAS: self._resolve_project_slug_alias,
            constants.PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
            "avg_metric": self._resolve_avg_alias,
        }

    @property
    def function_converter(self) -> Mapping[str, SnQLFunction]:
        return {
            function.name: function
            for function in [
                SnQLFunction(
                    "examples",
                    snql_aggregate=self._resolve_random_samples,
                    optional_args=[with_default(1, NumberRange("count", 1, None))],
                    private=True,
                ),
                SnQLFunction(
                    "rounded_timestamp",
                    required_args=[IntervalDefault("interval", 1, None)],
                    snql_column=lambda args, alias: function_aliases.resolve_rounded_timestamp(
                        args["interval"], alias, timestamp_column="end_timestamp"
                    ),
                    private=True,
                ),
            ]
        }

    @property
    def orderby_converter(self) -> Mapping[str, Callable[[Direction], OrderBy]]:
        return {}

    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.project_slug_converter(self.builder, search_filter)

    def _metric_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        column = search_filter.key.name
        value = search_filter.value.value
        return And(
            [
                Condition(self.builder.column(column), Op.EQ, value),
                # The metrics summaries table orders by the cityHash64 of the metric name.
                # In order to take full advantage of the order by of the table, add an
                # additional condition on the cityHash64 of the metric name.
                Condition(
                    Function("cityHash64", [self.builder.column(column)]),
                    Op.EQ,
                    Function("cityHash64", [value]),
                ),
            ]
        )

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        return field_aliases.resolve_project_slug_alias(self.builder, alias)

    def _resolve_avg_alias(self, alias: str) -> SelectType:
        return Function(
            "divide",
            [self.builder.column("sum_metric"), self.builder.column("count_metric")],
            alias,
        )

    def _resolve_random_samples(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str,
    ) -> SelectType:
        offset = 0 if self.builder.offset is None else self.builder.offset.offset
        limit = 0 if self.builder.limit is None else self.builder.limit.limit
        return function_aliases.resolve_random_samples(
            [
                # DO NOT change the order of these columns
                self.builder.resolve_column("span.group"),
                self.builder.resolve_column("timestamp"),
                self.builder.resolve_column("id"),
                self.builder.resolve_column("min_metric"),
                self.builder.resolve_column("max_metric"),
                self.builder.resolve_column("sum_metric"),
                self.builder.resolve_column("count_metric"),
                self.builder.resolve_column("avg_metric"),
            ],
            alias,
            offset,
            limit,
        )
