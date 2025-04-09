from __future__ import annotations

from typing import Any

from snuba_sdk import (
    AliasedExpression,
    And,
    Column,
    Condition,
    CurriedFunction,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    Op,
    Or,
    OrderBy,
    Query,
    Request,
)

from sentry.api import event_search
from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import InvalidSearchQuery
from sentry.options.rollout import in_rollout_group
from sentry.search.events import constants
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.datasets.discover import DiscoverDatasetConfig
from sentry.search.events.types import (
    HistogramParams,
    ParamsType,
    QueryBuilderConfig,
    SelectType,
    SnubaParams,
    WhereType,
)
from sentry.snuba.dataset import Dataset


class DiscoverQueryBuilder(BaseQueryBuilder):
    """Builds a discover query"""

    uuid_fields = {
        "id",
        "trace",
        "profile.id",
        "replay.id",
    }
    span_id_fields = {
        "trace.span",
        "trace.parent_span",
    }
    duration_fields = {"transaction.duration"}

    def load_config(
        self,
    ) -> DatasetConfig:
        # Necessary until more classes inherit from BaseQueryBuilder instead
        if hasattr(self, "config_class") and self.config_class is not None:
            return super().load_config()

        self.config: DatasetConfig
        if self.dataset in [
            Dataset.Discover,
            Dataset.Transactions,
            Dataset.Events,
            Dataset.IssuePlatform,
        ]:
            return DiscoverDatasetConfig(self)
        else:
            raise NotImplementedError(f"Data Set configuration not found for {self.dataset}.")

    def resolve_field(self, raw_field: str, alias: bool = False) -> Column:
        tag_match = constants.TAG_KEY_RE.search(raw_field)
        field = tag_match.group("tag") if tag_match else raw_field

        if field == "group_id":
            # We don't expose group_id publicly, so if a user requests it
            # we expect it is a custom tag. Convert it to tags[group_id]
            # and ensure it queries tag data
            # These maps are updated so the response can be mapped back to group_id
            self.tag_to_prefixed_map["group_id"] = "tags[group_id]"
            self.prefixed_to_tag_map["tags[group_id]"] = "group_id"
            raw_field = "tags[group_id]"

        return super().resolve_field(raw_field, alias)

    def resolve_projects(self) -> list[int]:
        if self.params.organization_id and in_rollout_group(
            "sentry.search.events.project.check_event", self.params.organization_id
        ):
            if self.dataset == Dataset.Discover:
                project_ids = [
                    proj.id
                    for proj in self.params.projects
                    if proj.flags.has_transactions or proj.first_event is not None
                ]
            elif self.dataset == Dataset.Events:
                project_ids = [
                    proj.id for proj in self.params.projects if proj.first_event is not None
                ]
            elif self.dataset in [Dataset.Transactions, Dataset.IssuePlatform]:
                project_ids = [
                    proj.id for proj in self.params.projects if proj.flags.has_transactions
                ]
            else:
                return super().resolve_projects()

            if len(project_ids) == 0:
                raise InvalidSearchQuery(
                    "All the projects in your query haven't received data yet, so no query was ran"
                )
            else:
                return project_ids
        else:
            return super().resolve_projects()

    def get_function_result_type(
        self,
        function: str,
    ) -> str | None:
        if function in constants.TREND_FUNCTION_TYPE_MAP:
            # HACK: Don't invalid query here if we don't recognize the function
            # this is cause non-snql tests still need to run and will check here
            # TODO: once non-snql is removed and trends has its own builder this
            # can be removed
            return constants.TREND_FUNCTION_TYPE_MAP.get(function)

        return super().get_function_result_type(function)

    def format_search_filter(self, term: event_search.SearchFilter) -> WhereType | None:
        """For now this function seems a bit redundant inside QueryFilter but
        most of the logic from the existing format_search_filter hasn't been
        converted over yet
        """
        name = term.key.name

        converted_filter = self.convert_search_filter_to_condition(
            event_search.SearchFilter(
                # We want to use group_id elsewhere so shouldn't be removed from the dataset
                # but if a user has a tag with the same name we want to make sure that works
                event_search.SearchKey("tags[group_id]" if name == "group_id" else name),
                term.operator,
                term.value,
            )
        )
        return converted_filter if converted_filter else None

    def default_filter_converter(
        self, search_filter: event_search.SearchFilter
    ) -> WhereType | None:
        name = search_filter.key.name
        operator = search_filter.operator
        value = search_filter.value.value

        # Some fields aren't valid queries
        if name in constants.SKIP_FILTER_RESOLUTION:
            name = f"tags[{name}]"

        if name in constants.TIMESTAMP_FIELDS:
            if not self.start or not self.end:
                raise InvalidSearchQuery(
                    f"Cannot query the {name} field without a valid date range"
                )

            if (
                operator in ["<", "<="]
                and value < self.start
                or operator in [">", ">="]
                and value > self.end
            ):
                raise InvalidSearchQuery(
                    "Filter on timestamp is outside of the selected date range."
                )

        return super().default_filter_converter(search_filter)


class UnresolvedQuery(DiscoverQueryBuilder):
    def resolve_query(
        self,
        query: str | None = None,
        selected_columns: list[str] | None = None,
        groupby_columns: list[str] | None = None,
        equations: list[str] | None = None,
        orderby: list[str] | str | None = None,
    ) -> None:
        pass


class TimeseriesQueryBuilder(UnresolvedQuery):
    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        interval: int,
        snuba_params: SnubaParams | None = None,
        query: str | None = None,
        selected_columns: list[str] | None = None,
        equations: list[str] | None = None,
        limit: int | None = 10000,
        config: QueryBuilderConfig | None = None,
    ):
        config = config if config is not None else QueryBuilderConfig()
        config.auto_fields = False
        config.equation_config = {"auto_add": True, "aggregates_only": True}
        self.interval = interval
        super().__init__(
            dataset,
            params,
            snuba_params=snuba_params,
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            config=config,
        )

        self.granularity = Granularity(interval)

        self.limit = None if limit is None else Limit(limit)

        # This is a timeseries, the groupby will always be time
        self.groupby = [self.time_column]

    @property
    def time_column(self) -> SelectType:
        return Column("time")

    def resolve_query(
        self,
        query: str | None = None,
        selected_columns: list[str] | None = None,
        groupby_columns: list[str] | None = None,
        equations: list[str] | None = None,
        orderby: list[str] | str | None = None,
    ) -> None:
        self.resolve_time_conditions()
        self.where, self.having = self.resolve_conditions(query)

        # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
        self.where += self.resolve_params()
        self.columns = self.resolve_select(selected_columns, equations)

    @property
    def select(self) -> list[SelectType]:
        if not self.aggregates:
            raise InvalidSearchQuery("Cannot query a timeseries without a Y-Axis")
        # Casting for now since QueryFields/QueryFilter are only partially typed
        return self.aggregates

    def get_snql_query(self) -> Request:
        return Request(
            dataset=self.dataset.value,
            app_id="default",
            query=Query(
                match=Entity(self._get_entity_name()),
                select=self.select,
                where=self.where,
                having=self.having,
                groupby=self.groupby,
                orderby=[OrderBy(self.time_column, Direction.ASC)],
                granularity=self.granularity,
                limit=self.limit,
            ),
            tenant_ids=self.tenant_ids,
        )


class TopEventsQueryBuilder(TimeseriesQueryBuilder):
    """Create one of two top events queries, which is used for the Top Period &
    Top Daily displays

    This builder requires a Snuba response dictionary that already contains
    the top events for the parameters being queried. eg.
    `[{transaction: foo, count: 100}, {transaction: bar, count:50}]`

    Two types of queries can be constructed through this builder:

    First getting each timeseries for each top event (other=False). Which
    roughly results in a query like the one below. The Groupby allow us to
    get additional rows per time window for each transaction. And the Where
    clause narrows the results to those in the top events:
    ```
        SELECT
            transaction, count(), time
        FROM
            discover
        GROUP BY
            transaction, time
        WHERE
            transaction IN ['foo', 'bar']
    ```

    Secondly This builder can also be used for getting a single timeseries
    for all events not in the top (other=True). Which is done by taking the
    previous query, dropping the groupby, and negating the condition eg.
    ```
        SELECT
            count(), time
        FROM
            discover
        GROUP BY
            time
        WHERE
            transaction NOT IN ['foo', 'bar']
    ```
    """

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
        equations = [] if equations is None else equations
        timeseries_equations, timeseries_functions = categorize_columns(timeseries_columns)
        super().__init__(
            dataset,
            params,
            snuba_params=snuba_params,
            interval=interval,
            query=query,
            selected_columns=list(set(selected_columns + timeseries_functions)),
            equations=list(set(equations + timeseries_equations)),
            limit=limit,
            config=config,
        )

        self.fields: list[str] = selected_columns if selected_columns is not None else []
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
                translated.append(groupby.alias)
            else:
                translated.append(groupby.name)
        # sorted so the result key is consistent
        return sorted(translated)

    def resolve_top_event_conditions(
        self, top_events: list[dict[str, Any]], other: bool
    ) -> WhereType | None:
        """Given a list of top events construct the conditions"""
        conditions = []
        for field in self.fields:
            # If we have a project field, we need to limit results by project so we don't hit the result limit
            if field in ["project", "project.id", "project.name"] and top_events:
                # Iterate through the existing conditions to find the project one
                # the project condition is a requirement of queries so there should always be one
                project_condition = [
                    condition
                    for condition in self.where
                    if isinstance(condition, Condition)
                    and condition.lhs == self.column("project_id")
                ][0]
                self.where.remove(project_condition)
                if field in ["project", "project.name"]:
                    projects = list(
                        {self.params.project_slug_map[event[field]] for event in top_events}
                    )
                else:
                    projects = list({event["project.id"] for event in top_events})

                if other:
                    projects = list(set(self.params.project_ids) - set(projects))

                    # if there are no more projects, we search on project id 0 to guarantee no results
                    if not projects:
                        projects = [0]

                self.where.append(Condition(self.column("project_id"), Op.IN, projects))
                continue

            resolved_field = self.resolve_column(self.prefixed_to_tag_map.get(field, field))

            values: set[Any] = set()
            for event in top_events:
                if field in event:
                    alias = field
                elif self.is_column_function(resolved_field) and resolved_field.alias in event:
                    alias = resolved_field.alias
                else:
                    continue

                # Note that because orderby shouldn't be an array field its not included in the values
                if isinstance(event.get(alias), list):
                    continue
                else:
                    values.add(event.get(alias))
            values_list = list(values)

            if values_list:
                if field == "timestamp" or field.startswith("timestamp.to_"):
                    if not other:
                        # timestamp fields needs special handling, creating a big OR instead
                        function, operator = Or, Op.EQ
                    else:
                        # Needs to be a big AND when negated
                        function, operator = And, Op.NEQ
                    if len(values_list) > 1:
                        conditions.append(
                            function(
                                conditions=[
                                    Condition(resolved_field, operator, value)
                                    for value in sorted(values_list)
                                ]
                            )
                        )
                    else:
                        conditions.append(Condition(resolved_field, operator, values_list[0]))
                elif None in values_list:
                    # one of the values was null, but we can't do an in with null values, so split into two conditions
                    non_none_values = [value for value in values_list if value is not None]
                    null_condition = Condition(
                        Function("isNull", [resolved_field]), Op.EQ if not other else Op.NEQ, 1
                    )
                    if non_none_values:
                        non_none_condition = Condition(
                            resolved_field, Op.IN if not other else Op.NOT_IN, non_none_values
                        )
                        if not other:
                            conditions.append(Or(conditions=[null_condition, non_none_condition]))
                        else:
                            conditions.append(And(conditions=[null_condition, non_none_condition]))
                    else:
                        conditions.append(null_condition)
                else:
                    conditions.append(
                        Condition(resolved_field, Op.IN if not other else Op.NOT_IN, values_list)
                    )
        if len(conditions) > 1:
            final_function = And if not other else Or
            final_condition = final_function(conditions=conditions)
        elif len(conditions) == 1:
            final_condition = conditions[0]
        else:
            final_condition = None
        return final_condition


class HistogramQueryBuilder(DiscoverQueryBuilder):
    base_function_acl = ["array_join", "histogram", "spans_histogram"]

    def __init__(
        self,
        num_buckets: int,
        histogram_column: str,
        histogram_rows: int | None,
        histogram_params: HistogramParams,
        key_column: str | None,
        field_names: list[str | Any | None] | None,
        groupby_columns: list[str] | None,
        *args: Any,
        **kwargs: Any,
    ):
        config = kwargs.get("config", QueryBuilderConfig())
        functions_acl = config.functions_acl if config.functions_acl else []
        config.functions_acl = functions_acl + self.base_function_acl
        kwargs["config"] = config
        super().__init__(*args, **kwargs)
        self.additional_groupby = groupby_columns
        selected_columns = kwargs["selected_columns"]

        resolved_histogram = self.resolve_column(histogram_column)

        # Reset&Ignore the columns from the QueryBuilder
        self.aggregates: list[CurriedFunction] = []
        self.columns = [self.resolve_column("count()"), resolved_histogram]

        if key_column is not None and field_names is not None:
            key_values: list[str] = [field for field in field_names if isinstance(field, str)]
            self.where.append(Condition(self.resolve_column(key_column), Op.IN, key_values))

        # make sure to bound the bins to get the desired range of results
        min_bin = histogram_params.start_offset
        self.where.append(Condition(resolved_histogram, Op.GTE, min_bin))
        max_bin = histogram_params.start_offset + histogram_params.bucket_size * num_buckets
        self.where.append(Condition(resolved_histogram, Op.LTE, max_bin))

        if key_column is not None:
            self.columns.append(self.resolve_column(key_column))

        groups = len(selected_columns) if histogram_rows is None else histogram_rows
        self.limit = Limit(groups * num_buckets)
        self.orderby = (self.orderby if self.orderby else []) + [
            OrderBy(resolved_histogram, Direction.ASC)
        ]

        self.groupby = self.resolve_groupby(groupby_columns)
