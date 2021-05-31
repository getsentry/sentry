from typing import List, Optional

from snuba_sdk.column import Column

from sentry.search.events.constants import SNQL_FIELD_ALLOWLIST
from sentry.search.events.types import AggregateType, ParamsType, SelectType, WhereType
from sentry.utils.snuba import Dataset, resolve_column


class QueryBase:
    field_allowlist = SNQL_FIELD_ALLOWLIST

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        orderby: Optional[List[str]] = None,
    ):
        self.aggregates: List[AggregateType] = []
        self.columns: List[SelectType] = []
        self.where: List[WhereType] = []

        self.params = params
        self.dataset = dataset
        self.orderby_columns: List[str] = orderby if orderby else []

        self.resolve_column_name = resolve_column(self.dataset)

    def column(self, name: str) -> Column:
        return Column(self.resolve_column_name(name))
