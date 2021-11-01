from typing import List, Optional, Tuple

from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity, Limit, Offset
from snuba_sdk.function import CurriedFunction
from snuba_sdk.orderby import Direction, LimitBy, OrderBy
from snuba_sdk.query import Query

from sentry.search.events.fields import InvalidSearchQuery
from sentry.search.events.filter import QueryFilter
from sentry.search.events.types import ParamsType, SelectType
from sentry.utils.snuba import Dataset


class QueryBuilder(QueryFilter):
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
    ):
        super().__init__(dataset, params, auto_fields, functions_acl)

        self.auto_aggregations = auto_aggregations

        self.limit = None if limit is None else Limit(limit)
        self.offset = None if offset is None else Offset(offset)

        self.limitby = self.resolve_limitby(limitby)

        self.where, self.having = self.resolve_conditions(
            query, use_aggregate_conditions=use_aggregate_conditions
        )

        # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
        self.where += self.resolve_params()

        self.columns = self.resolve_select(selected_columns, equations)
        self.orderby = self.resolve_orderby(orderby)
        self.array_join = None if array_join is None else self.resolve_column(array_join)

    def resolve_limitby(self, limitby: Optional[Tuple[str, int]]) -> Optional[LimitBy]:
        if limitby is None:
            return None

        column, count = limitby
        resolved = self.resolve_column(column)

        if isinstance(resolved, Column):
            return LimitBy(resolved, count)

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

    def validate_aggregate_arguments(self):
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
                raise InvalidSearchQuery(
                    f"A single field cannot be used both inside and outside a function in the same query. To use {column.alias} you must first remove the function(s): {function_msg}"
                )

    def validate_having_clause(self) -> None:
        """Validate that the functions in having are selected columns

        Skipped if auto_aggregations are enabled, and at least one other aggregate is selected
        This is so we don't change grouping suddenly
        """
        if self.auto_aggregations and self.aggregates:
            return
        error_extra = ", and could not be automatically added" if self.auto_aggregations else ""
        for condition in self.having:
            lhs = condition.lhs
            if lhs not in self.columns:
                raise InvalidSearchQuery(
                    "Aggregate {} used in a condition but is not a selected column{}.".format(
                        lhs.alias,
                        error_extra,
                    )
                )

    def add_conditions(self, conditions: List[Condition]) -> None:
        self.where += conditions

    def get_snql_query(self) -> Query:
        self.validate_having_clause()

        return Query(
            dataset=self.dataset.value,
            match=Entity(self.dataset.value),
            select=self.columns,
            array_join=self.array_join,
            where=self.where,
            having=self.having,
            groupby=self.groupby,
            orderby=self.orderby,
            limit=self.limit,
            offset=self.offset,
            limitby=self.limitby,
        )


class TimeseriesQueryBuilder(QueryFilter):
    time_column = Column("time")

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        granularity: int,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
    ):
        super().__init__(
            dataset,
            params,
            auto_fields=False,
            functions_acl=[],
            equation_config={"auto_add": True, "aggregates_only": True},
        )
        self.where, self.having = self.resolve_conditions(query, use_aggregate_conditions=True)

        self.limit = None if limit is None else Limit(limit)

        # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
        self.where += self.resolve_params()
        self.columns = self.resolve_select(selected_columns, equations)
        self.granularity = Granularity(granularity)

    @property
    def select(self) -> List[SelectType]:
        if not self.aggregates:
            raise InvalidSearchQuery("Cannot query a timeseries without a Y-Axis")
        return self.aggregates

    def get_snql_query(self) -> Query:
        return Query(
            dataset=self.dataset.value,
            match=Entity(self.dataset.value),
            select=self.select,
            where=self.where,
            having=self.having,
            # This is a timeseries, the groupby will always be time
            groupby=[self.time_column],
            orderby=[OrderBy(self.time_column, Direction.ASC)],
            granularity=self.granularity,
            limit=self.limit,
        )
