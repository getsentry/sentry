from typing import Any, List, Optional, Sequence

from snuba_sdk import Column, Entity, Flags, Granularity, Query, Request

from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import SelectType, WhereType


class SessionsQueryBuilder(QueryBuilder):
    requires_organization_condition = True
    organization_column: str = "org_id"


class SessionsV2QueryBuilder(QueryBuilder):
    filter_allowlist_fields = {"project", "project_id", "environment", "release"}
    requires_organization_condition = True
    organization_column: str = "org_id"

    def __init__(
        self,
        *args: Any,
        granularity: Optional[int] = None,
        extra_filter_allowlist_fields: Optional[Sequence[str]] = None,
        **kwargs: Any,
    ):
        self._extra_filter_allowlist_fields = extra_filter_allowlist_fields or []
        self.granularity = Granularity(granularity) if granularity is not None else None
        super().__init__(*args, **kwargs)

    def resolve_groupby(self, groupby_columns: Optional[List[str]] = None) -> List[SelectType]:
        """
        The default QueryBuilder `resolve_groupby` function needs to be overridden here because, it only adds the
        columns in the groupBy clause to the query if the query has `aggregates` present in it. For this specific case
        of the `sessions` dataset, the session fields are aggregates but these aggregate definitions are hidden away in
        snuba so if we rely on the default QueryBuilder `resolve_groupby` method, then it won't add the requested
        groupBy columns as it does not consider these fields as aggregates, and so we end up with clickhouse error that
        the column is not under an aggregate function or in the `groupBy` basically.
        """
        if groupby_columns is None:
            return []
        return list({self.resolve_column(column) for column in groupby_columns})

    def default_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        name = search_filter.key.name
        if name in self.filter_allowlist_fields or name in self._extra_filter_allowlist_fields:
            return super().default_filter_converter(search_filter)
        raise InvalidSearchQuery(f"Invalid search filter: {name}")


class TimeseriesSessionsV2QueryBuilder(SessionsV2QueryBuilder):
    time_column = "bucketed_started"

    def get_snql_query(self) -> Request:
        self.validate_having_clause()

        return Request(
            dataset=self.dataset.value,
            app_id="default",
            query=Query(
                match=Entity(self.dataset.value, sample=self.sample_rate),
                select=[Column(self.time_column)] + self.columns,
                array_join=self.array_join,
                where=self.where,
                having=self.having,
                groupby=[Column(self.time_column)] + self.groupby,
                orderby=self.orderby,
                limit=self.limit,
                offset=self.offset,
                granularity=self.granularity,
                limitby=self.limitby,
            ),
            flags=Flags(turbo=self.turbo),
            tenant_ids=self.tenant_ids,
        )
