from __future__ import annotations

from collections.abc import Callable, Mapping

from snuba_sdk import Direction, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.search.events import builder, constants
from sentry.search.events.datasets import field_aliases, filter_aliases, function_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import IntervalDefault, SnQLFunction
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
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            constants.PROJECT_ALIAS: self._resolve_project_slug_alias,
            constants.PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
        }

    @property
    def function_converter(self) -> Mapping[str, SnQLFunction]:
        return {
            function.name: function
            for function in [
                SnQLFunction(
                    "example",
                    snql_aggregate=lambda args, alias: function_aliases.resolve_random_sample(
                        ["group", "end_timestamp", "span_id"], alias
                    ),
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

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        return field_aliases.resolve_project_slug_alias(self.builder, alias)
