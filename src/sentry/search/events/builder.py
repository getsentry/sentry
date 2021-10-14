from typing import List, Optional, Tuple

from snuba_sdk.column import Column
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Limit, Offset
from snuba_sdk.orderby import LimitBy
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
        orderby: Optional[List[str]] = None,
        auto_fields: bool = False,
        auto_aggregations: bool = False,
        use_aggregate_conditions: bool = False,
        functions_acl: Optional[List[str]] = None,
        limit: Optional[int] = 50,
        offset: Optional[int] = 0,
        limitby: Optional[Tuple[str, int]] = None,
    ):
        super().__init__(dataset, params, auto_fields, functions_acl)

        # TODO: implement this in `resolve_select`
        self.auto_aggregations = auto_aggregations

        self.limit = None if limit is None else Limit(limit)
        self.offset = None if offset is None else Offset(offset)

        self.limitby = self.resolve_limitby(limitby)

        self.where, self.having = self.resolve_conditions(
            query, use_aggregate_conditions=use_aggregate_conditions
        )

        # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
        self.where += self.resolve_params()

        self.columns = self.resolve_select(selected_columns)
        self.orderby = self.resolve_orderby(orderby)

    @property
    def select(self) -> Optional[List[SelectType]]:
        return self.columns

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
            return [c for c in self.columns if c not in self.aggregates]
        else:
            return []

    def validate_having_clause(self):
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

    def get_snql_query(self) -> Query:
        self.validate_having_clause()

        return Query(
            dataset=self.dataset.value,
            match=Entity(self.dataset.value),
            select=self.select,
            where=self.where,
            having=self.having,
            groupby=self.groupby,
            orderby=self.orderby,
            limit=self.limit,
            offset=self.offset,
            limitby=self.limitby,
        )
