from __future__ import annotations

from typing import List, Optional

from snuba_sdk import Column, Entity, Flags, Query, Request

from sentry.search.events.builder import QueryBuilder


class ErrorsQueryBuilder(QueryBuilder):
    def __init__(self, *args, **kwargs):
        self.match = None
        super().__init__(*args, **kwargs)

    def resolve_match(self):
        self.match = Entity(self.dataset.value, alias=self.dataset.value, sample=self.sample_rate)

    def resolve_query(
        self,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        groupby_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: list[str] | str | None = None,
    ) -> None:
        super().resolve_query(query, selected_columns, groupby_columns, equations, orderby)
        self.resolve_match()

    def get_snql_query(self) -> Request:
        self.validate_having_clause()
        return Request(
            dataset=self.dataset.value,
            app_id="default",
            query=Query(
                match=self.match,
                select=self.columns,
                array_join=self.array_join,
                where=self.where,
                having=self.having,
                groupby=self.groupby,
                orderby=self.orderby,
                limit=self.limit,
                offset=self.offset,
                limitby=self.limitby,
            ),
            flags=Flags(turbo=self.turbo),
            tenant_ids=self.tenant_ids,
        )

    def column(self, name: str) -> Column:
        """Given an unresolved sentry name and return a snql column.

        :param name: The unresolved sentry name.
        """
        resolved_column = self.resolve_column_name(name)
        return Column(resolved_column, entity=Entity(self.dataset.value, alias=self.dataset.value))
