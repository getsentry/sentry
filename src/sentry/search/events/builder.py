from typing import Any, Dict, List, Optional, Set, Tuple, Union, cast

from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import And, BooleanCondition, Condition, Op, Or
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity, Limit, Offset, Turbo
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import Direction, LimitBy, OrderBy
from snuba_sdk.query import Query

from sentry.discover.arithmetic import categorize_columns
from sentry.search.events.fields import InvalidSearchQuery
from sentry.search.events.filter import QueryFilter
from sentry.search.events.types import HistogramParams, ParamsType, SelectType, WhereType
from sentry.utils.snuba import Dataset


class QueryBuilder(QueryFilter):  # type: ignore
    """Builds a snql query"""

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
        auto_fields: bool = False,
        auto_aggregations: bool = False,
        use_aggregate_conditions: bool = False,
        functions_acl: Optional[List[str]] = None,
        array_join: Optional[str] = None,
        limit: Optional[int] = 50,
        offset: Optional[int] = 0,
        limitby: Optional[Tuple[str, int]] = None,
        turbo: bool = False,
        sample_rate: Optional[float] = None,
    ):
        super().__init__(dataset, params, auto_fields, functions_acl)

        self.auto_aggregations = auto_aggregations

        self.limit = None if limit is None else Limit(limit)
        self.offset = None if offset is None else Offset(offset)

        self.limitby = self.resolve_limitby(limitby)
        self.turbo = Turbo(turbo)
        self.sample_rate = sample_rate

        self.where, self.having = self.resolve_conditions(
            query, use_aggregate_conditions=use_aggregate_conditions
        )

        # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
        self.where += self.resolve_params()

        self.columns = self.resolve_select(selected_columns, equations)
        self.orderby = self.resolve_orderby(orderby)
        self.array_join = None if array_join is None else [self.resolve_column(array_join)]

    def resolve_limitby(self, limitby: Optional[Tuple[str, int]]) -> Optional[LimitBy]:
        if limitby is None:
            return None

        column, count = limitby
        resolved = self.resolve_column(column)

        if isinstance(resolved, Column):
            return LimitBy([resolved], count)

        # TODO: Limit By can only operate on a `Column`. This has the implication
        # that non aggregate transforms are not allowed in the order by clause.
        raise InvalidSearchQuery(f"{column} used in a limit by but is not a column.")

    @property
    def groupby(self) -> Optional[List[SelectType]]:
        if self.aggregates:
            self.validate_aggregate_arguments()
            return [
                c
                for c in self.columns
                if c not in self.aggregates and not self.is_equation_column(c)
            ]
        else:
            return []

    def validate_aggregate_arguments(self) -> None:
        for column in self.columns:
            if column in self.aggregates:
                continue
            conflicting_functions: List[CurriedFunction] = []
            for aggregate in self.aggregates:
                if column in aggregate.parameters:
                    conflicting_functions.append(aggregate)
            if conflicting_functions:
                # The first two functions and then a trailing count of remaining functions
                function_msg = ", ".join(
                    [self.get_public_alias(function) for function in conflicting_functions[:2]]
                ) + (
                    f" and {len(conflicting_functions) - 2} more."
                    if len(conflicting_functions) > 2
                    else ""
                )
                alias = column.name if type(column) == Column else column.alias
                raise InvalidSearchQuery(
                    f"A single field cannot be used both inside and outside a function in the same query. To use {alias} you must first remove the function(s): {function_msg}"
                )

    @property
    def flattened_having(self) -> List[Condition]:
        """Return self.having as a flattened list ignoring boolean operators
        This is because self.having can have a mix of BooleanConditions and Conditions. And each BooleanCondition can in
        turn be a mix of either type.
        """
        flattened: List[Condition] = []
        boolean_conditions: List[BooleanCondition] = []

        for condition in self.having:
            if isinstance(condition, Condition):
                flattened.append(condition)
            elif isinstance(condition, BooleanCondition):
                boolean_conditions.append(condition)

        while len(boolean_conditions) > 0:
            boolean_condition = boolean_conditions.pop()
            for condition in boolean_condition.conditions:
                if isinstance(condition, Condition):
                    flattened.append(condition)
                elif isinstance(condition, BooleanCondition):
                    boolean_conditions.append(condition)

        return flattened

    def validate_having_clause(self) -> None:
        """Validate that the functions in having are selected columns

        Skipped if auto_aggregations are enabled, and at least one other aggregate is selected
        This is so we don't change grouping suddenly
        """

        conditions = self.flattened_having
        if self.auto_aggregations and self.aggregates:
            for condition in conditions:
                lhs = condition.lhs
                if isinstance(lhs, CurriedFunction) and lhs not in self.columns:
                    self.columns.append(lhs)
                    self.aggregates.append(lhs)
            return
        # If auto aggregations is disabled or aggregations aren't present in the first place we throw an error
        else:
            error_extra = ", and could not be automatically added" if self.auto_aggregations else ""
            for condition in conditions:
                lhs = condition.lhs
                if isinstance(lhs, CurriedFunction) and lhs not in self.columns:
                    raise InvalidSearchQuery(
                        "Aggregate {} used in a condition but is not a selected column{}.".format(
                            lhs.alias,
                            error_extra,
                        )
                    )

    def get_snql_query(self) -> Query:
        self.validate_having_clause()

        return Query(
            dataset=self.dataset.value,
            match=Entity(self.dataset.value, sample=self.sample_rate),
            select=self.columns,
            array_join=self.array_join,
            where=self.where,
            having=self.having,
            groupby=self.groupby,
            orderby=self.orderby,
            limit=self.limit,
            offset=self.offset,
            limitby=self.limitby,
            turbo=self.turbo,
        )


class TimeseriesQueryBuilder(QueryFilter):  # type: ignore
    time_column = Column("time")

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        granularity: int,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        functions_acl: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
    ):
        super().__init__(
            dataset,
            params,
            auto_fields=False,
            functions_acl=functions_acl,
            equation_config={"auto_add": True, "aggregates_only": True},
        )
        self.where, self.having = self.resolve_conditions(query, use_aggregate_conditions=False)

        self.limit = None if limit is None else Limit(limit)

        # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
        self.where += self.resolve_params()
        self.columns = self.resolve_select(selected_columns, equations)
        self.granularity = Granularity(granularity)

        # This is a timeseries, the groupby will always be time
        self.groupby = [self.time_column]

    @property
    def select(self) -> List[SelectType]:
        if not self.aggregates:
            raise InvalidSearchQuery("Cannot query a timeseries without a Y-Axis")
        # Casting for now since QueryFields/QueryFilter are only partially typed
        return cast(List[SelectType], self.aggregates)

    def get_snql_query(self) -> Query:
        return Query(
            dataset=self.dataset.value,
            match=Entity(self.dataset.value),
            select=self.select,
            where=self.where,
            having=self.having,
            groupby=self.groupby,
            orderby=[OrderBy(self.time_column, Direction.ASC)],
            granularity=self.granularity,
            limit=self.limit,
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
        granularity: int,
        top_events: List[Dict[str, Any]],
        other: bool = False,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        timeseries_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        functions_acl: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
    ):
        selected_columns = [] if selected_columns is None else selected_columns
        timeseries_columns = [] if timeseries_columns is None else timeseries_columns
        equations = [] if equations is None else equations
        timeseries_equations, timeseries_functions = categorize_columns(timeseries_columns)
        super().__init__(
            dataset,
            params,
            granularity=granularity,
            query=query,
            selected_columns=list(set(selected_columns + timeseries_functions)),
            equations=list(set(equations + timeseries_equations)),
            functions_acl=functions_acl,
            limit=limit,
        )

        self.fields: List[str] = selected_columns if selected_columns is not None else []

        if (conditions := self.resolve_top_event_conditions(top_events, other)) is not None:
            self.where.append(conditions)

        if not other:
            self.groupby.extend(
                [column for column in self.columns if column not in self.aggregates]
            )

    @property
    def translated_groupby(self) -> List[str]:
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
        self, top_events: List[Dict[str, Any]], other: bool
    ) -> Optional[WhereType]:
        """Given a list of top events construct the conditions"""
        conditions = []
        for field in self.fields:
            # If we have a project field, we need to limit results by project so we don't hit the result limit
            if field in ["project", "project.id"] and top_events:
                # Iterate through the existing conditions to find the project one
                # the project condition is a requirement of queries so there should always be one
                project_condition = [
                    condition
                    for condition in self.where
                    if type(condition) == Condition and condition.lhs == self.column("project_id")
                ][0]
                self.where.remove(project_condition)
                if field == "project":
                    projects = list({self.project_slugs[event["project"]] for event in top_events})
                else:
                    projects = list({event["project.id"] for event in top_events})
                self.where.append(Condition(self.column("project_id"), Op.IN, projects))
                continue

            resolved_field = self.resolve_column(field)

            values: Set[Any] = set()
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


class HistogramQueryBuilder(QueryBuilder):
    base_function_acl = ["array_join", "histogram"]

    def __init__(
        self,
        num_buckets: int,
        histogram_column: str,
        histogram_rows: Optional[int],
        histogram_params: HistogramParams,
        key_column: Optional[str],
        field_names: Optional[List[Union[str, Any, None]]],
        groupby: Optional[List[str]],
        *args: Any,
        **kwargs: Any,
    ):
        kwargs["functions_acl"] = kwargs.get("functions_acl", []) + self.base_function_acl
        super().__init__(*args, **kwargs)
        self.additional_groupby = groupby
        selected_columns = kwargs["selected_columns"]

        resolved_histogram = self.resolve_column(histogram_column)

        # Reset&Ignore the columns from the QueryBuilder
        self.aggregates: List[CurriedFunction] = []
        self.columns = [self.resolve_column("count()"), resolved_histogram]

        if key_column is not None and field_names is not None:
            key_values: List[str] = [field for field in field_names if isinstance(field, str)]
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

    @property
    def groupby(self) -> Optional[List[SelectType]]:
        base_groupby = super().groupby
        if base_groupby is not None and self.additional_groupby is not None:
            base_groupby += [self.resolve_column(field) for field in self.additional_groupby]

        return base_groupby
