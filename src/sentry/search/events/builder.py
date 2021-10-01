from typing import List, Optional

from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Limit, Offset
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
        auto_aggregations: bool = False,
        use_aggregate_conditions: bool = False,
        functions_acl: Optional[List[str]] = None,
        limit: int = 50,
        offset: Optional[int] = 0,
    ):
        super().__init__(dataset, params)

        # TODO: implement this in `resolve_select`
        self.auto_aggregations = auto_aggregations

        self.functions_acl = functions_acl

        self.limit = Limit(limit)
        self.offset = Offset(0 if offset is None else offset)

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
        )
