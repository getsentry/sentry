from typing import List, Optional

from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Limit
from snuba_sdk.query import Query

from sentry.search.events.fields import QueryFields
from sentry.search.events.filter import QueryFilter
from sentry.search.events.types import ParamsType, SelectType
from sentry.utils.snuba import Dataset


class QueryBuilder(QueryFilter, QueryFields):
    """Builds a snql query"""

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
        limit: int = 50,
    ):
        super().__init__(dataset, params)

        self.limit = Limit(limit)

        self.where = self.resolve_where(query)

        # params depends on get_filter since there may be projects in the query
        self.where += self.resolve_params()

        self.columns = self.resolve_select(selected_columns)
        self.orderby = self.resolve_orderby(orderby)

    @property
    def select(self) -> Optional[List[SelectType]]:
        return [*self.aggregates, *self.columns]

    @property
    def groupby(self) -> Optional[List[SelectType]]:
        if self.aggregates:
            return self.columns
        else:
            return []

    def get_snql_query(self) -> Query:
        return Query(
            dataset=self.dataset.value,
            match=Entity(self.dataset.value),
            select=self.select,
            where=self.where,
            groupby=self.groupby,
            orderby=self.orderby,
            limit=self.limit,
        )
