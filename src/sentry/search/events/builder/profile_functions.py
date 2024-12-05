from datetime import UTC, datetime
from typing import Any, Protocol

from snuba_sdk import AliasedExpression, And, Column, Condition, CurriedFunction, Op, Or
from snuba_sdk.function import Function

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.discover.arithmetic import categorize_columns
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.discover import TimeseriesQueryBuilder
from sentry.search.events.datasets.profile_functions import ProfileFunctionsDatasetConfig
from sentry.search.events.fields import custom_time_processor, get_function_alias
from sentry.search.events.types import (
    EventsResponse,
    ParamsType,
    QueryBuilderConfig,
    SelectType,
    SnubaParams,
    SnubaRow,
    WhereType,
)
from sentry.snuba.dataset import Dataset


class ProfileFunctionsQueryBuilderProtocol(Protocol):
    @property
    def config(self) -> ProfileFunctionsDatasetConfig: ...

    @property
    def params(self) -> SnubaParams: ...

    def column(self, name: str) -> Column: ...


class ProfileFunctionsQueryBuilderMixin:
    def resolve_column_name(self: ProfileFunctionsQueryBuilderProtocol, col: str) -> str:
        # giving resolved a type here convinces mypy that the type is str
        resolved: str = self.config.resolve_column(col)
        return resolved

    def get_field_type(self: ProfileFunctionsQueryBuilderProtocol, field: str) -> str | None:
        # giving resolved a type here convinces mypy that the type is str
        resolved: str | None = self.config.resolve_column_type(field)
        return resolved

    def process_profiling_function_columns(self, row: SnubaRow):
        # We need to check both the aliased and non aliased names
        # as not all use cases enable `transform_alias_to_input_format`
        # and the events-stats endpoint does not actually apply it.
        if "all_examples()" in row:
            key = "all_examples()"
        elif "all_examples" in row:
            key = "all_examples"
        else:
            key = None

        if key is not None:
            parsed_examples = []
            for example in row[key]:
                profile_id, thread_id, start, end = example

                # This is shaped like the `ExampleMetaData` in vroom
                if not start and not end:
                    parsed_examples.append(
                        {
                            "profile_id": profile_id,
                        }
                    )
                else:
                    parsed_examples.append(
                        {
                            "profiler_id": profile_id,
                            "thread_id": thread_id,
                            "start": datetime.fromisoformat(start).replace(tzinfo=UTC).timestamp(),
                            "end": datetime.fromisoformat(end).replace(tzinfo=UTC).timestamp(),
                        }
                    )

            row[key] = parsed_examples


class ProfileFunctionsQueryBuilder(ProfileFunctionsQueryBuilderMixin, BaseQueryBuilder):
    function_alias_prefix = "sentry_"
    config_class = ProfileFunctionsDatasetConfig

    def process_results(self, results: Any) -> EventsResponse:
        processed: EventsResponse = super().process_results(results)
        for row in processed["data"]:
            self.process_profiling_function_columns(row)
        return processed


class ProfileFunctionsTimeseriesQueryBuilder(
    ProfileFunctionsQueryBuilderMixin, TimeseriesQueryBuilder
):
    function_alias_prefix = "sentry_"
    config_class = ProfileFunctionsDatasetConfig

    def strip_alias_prefix(self, result):
        alias_mappings = {
            column: get_function_alias(function_details.field)
            for column, function_details in self.function_alias_map.items()
        }
        self.function_alias_map = {
            alias_mappings.get(column, column): function_details
            for column, function_details in self.function_alias_map.items()
        }
        result["data"] = [
            {alias_mappings.get(k, k): v for k, v in item.items()}
            for item in result.get("data", [])
        ]
        for item in result.get("meta", []):
            item["name"] = alias_mappings.get(item["name"], item["name"])
        return result

    @property
    def time_column(self) -> SelectType:
        return custom_time_processor(self.interval, Function("toUInt32", [Column("timestamp")]))

    def process_results(self, results: Any) -> EventsResponse:
        # Calling `super().process_results(results)` on the timeseries data
        # mutates the data in such a way that breaks the zerofill later such
        # as applying `transform_alias_to_input_format` setting.  So only run
        # it to get the correct meta.
        for row in results["data"]:
            self.process_profiling_function_columns(row)

        results["meta"] = super().process_results(results)["meta"]

        return results


class ProfileTopFunctionsTimeseriesQueryBuilder(ProfileFunctionsTimeseriesQueryBuilder):
    config_class = ProfileFunctionsDatasetConfig

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        interval: int,
        top_events: list[dict[str, Any]],
        snuba_params: SnubaParams | None = None,
        other: bool = False,
        query: str | None = None,
        selected_columns: list[str] | None = None,
        timeseries_columns: list[str] | None = None,
        equations: list[str] | None = None,
        config: QueryBuilderConfig | None = None,
        limit: int | None = 10000,
    ):
        selected_columns = [] if selected_columns is None else selected_columns
        timeseries_columns = [] if timeseries_columns is None else timeseries_columns
        _, timeseries_functions = categorize_columns(timeseries_columns)
        super().__init__(
            dataset,
            params,
            snuba_params=snuba_params,
            interval=interval,
            query=query,
            selected_columns=list(set(selected_columns + timeseries_functions)),
            equations=None,  # TODO: equations are not supported at this time
            limit=limit,
            config=config,
        )

        self.fields = [self.tag_to_prefixed_map.get(c, c) for c in selected_columns]

        if (conditions := self.resolve_top_event_conditions(top_events, other)) is not None:
            self.where.append(conditions)

        if not other:
            self.groupby.extend(
                [column for column in self.columns if column not in self.aggregates]
            )

    @property
    def translated_groupby(self) -> list[str]:
        """Get the names of the groupby columns to create the series names"""
        translated = []
        for groupby in self.groupby:
            if groupby == self.time_column:
                continue
            if isinstance(groupby, (CurriedFunction, AliasedExpression)):
                assert groupby.alias is not None
                translated.append(groupby.alias)
            else:
                translated.append(groupby.name)
        # sorted so the result key is consistent
        return sorted(translated)

    def is_aggregate_field(self, field: str) -> bool:
        resolved = self.resolve_column(self.prefixed_to_tag_map.get(field, field))
        return resolved in self.aggregates

    def resolve_top_event_conditions(
        self, top_functions: list[dict[str, Any]], other: bool
    ) -> WhereType | None:
        assert not other, "Other is not supported"  # TODO: support other

        # we only want to create conditions on the non aggregate fields
        fields = [field for field in self.fields if not self.is_aggregate_field(field)]

        conditions = []

        # if the project id is in the query, we can further narrow down the
        # list of projects to only the set that matches the top functions
        for field in fields:
            if field in ["project", "project.id"] and not other:
                project_condition = [
                    condition
                    for condition in self.where
                    if isinstance(condition, Condition)
                    and condition.lhs == self.column("project_id")
                ][0]
                self.where.remove(project_condition)

                if field == "project":
                    projects = list(
                        {
                            self.params.project_slug_map[function["project"]]
                            for function in top_functions
                        }
                    )
                else:
                    projects = list({function["project.id"] for function in top_functions})
                self.where.append(Condition(self.column("project_id"), Op.IN, projects))

        for function in top_functions:
            terms = [
                SearchFilter(SearchKey(field), "=", SearchValue(function.get(field) or ""))
                for field in fields
            ]
            function_condition = self.resolve_where(terms)
            if len(function_condition) > 1:
                conditions.append(And(function_condition))
            elif len(function_condition) == 1:
                conditions.append(function_condition[0])

        if len(conditions) > 1:
            return Or(conditions=conditions)
        elif len(conditions) == 1:
            return conditions[0]
        return None
