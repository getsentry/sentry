from typing import List, Optional

from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Limit
from snuba_sdk.query import Query

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
        use_aggregate_conditions: bool = False,
        limit: int = 50,
    ):
        super().__init__(dataset, params)

        self.limit = Limit(limit)

        parsed_terms = self.parse_query(query)
        self.where = self.resolve_where(parsed_terms)
        self.having = self.resolve_having(
            parsed_terms, use_aggregate_conditions=use_aggregate_conditions
        )

        # params depends on get_filter since there may be projects in the query
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

    def get_snql_query(self) -> Query:
        return Query(
            dataset=self.dataset.value,
            match=Entity(self.dataset.value),
            select=self.select,
            where=self.where,
            having=self.having,
            groupby=self.groupby,
            orderby=self.orderby,
            limit=self.limit,
        )
