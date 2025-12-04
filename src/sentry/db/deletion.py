from __future__ import annotations

import itertools
from collections.abc import Generator
from datetime import timedelta
from typing import TYPE_CHECKING, Any

from django.db import connections, router
from django.db.models import QuerySet
from django.utils import timezone

from sentry.utils.query import RangeQuerySetWrapper

if TYPE_CHECKING:
    from sentry.db.models.base import BaseModel


class BulkDeleteQuery:
    def __init__(
        self,
        model: type[BaseModel],
        project_id: int | None = None,
        organization_id: int | None = None,
        dtfield: str | None = None,
        days: int | None = None,
        order_by: str | None = None,
    ):
        self.model = model
        self.project_id = int(project_id) if project_id else None
        self.organization_id = int(organization_id) if organization_id else None
        self.dtfield = dtfield
        self.days = int(days) if days is not None else None
        self.order_by = order_by
        self.using = router.db_for_write(model)

    def execute(self, chunk_size: int = 10000) -> None:
        quote_name = connections[self.using].ops.quote_name

        where = []
        if self.dtfield and self.days is not None:
            where.append(
                "{} < '{}'::timestamptz".format(
                    quote_name(self.dtfield),
                    (timezone.now() - timedelta(days=self.days)).isoformat(),
                )
            )
        if self.project_id:
            where.append(f"project_id = {self.project_id}")
        if self.organization_id:
            where.append(f"organization_id = {self.organization_id}")

        if where:
            where_clause = "where {}".format(" and ".join(where))
        else:
            where_clause = ""

        if self.order_by:
            if self.order_by[0] == "-":
                direction = "desc"
                order_field = self.order_by[1:]
            else:
                direction = "asc"
                order_field = self.order_by
            order_clause = f"order by {quote_name(order_field)} {direction}"
        else:
            order_clause = ""

        query = """
            delete from {table}
            where id = any(array(
                select id
                from {table}
                {where}
                {order}
                limit {chunk_size}
            ));
        """.format(
            table=self.model._meta.db_table,
            chunk_size=chunk_size,
            where=where_clause,
            order=order_clause,
        )

        return self._continuous_query(query)

    def _continuous_query(self, query: str) -> None:
        results = True
        cursor = connections[self.using].cursor()
        while results:
            cursor.execute(query)
            results = cursor.rowcount > 0

    def iterator(
        self, chunk_size: int = 100, batch_size: int = 10000
    ) -> Generator[tuple[int, ...]]:
        """
        Iterate through matching record IDs using keyset pagination.

        Uses RangeQuerySetWrapper with compound order_by (order_field, id) to handle
        non-unique order fields correctly. This ensures all rows are returned even
        when multiple rows share the same order_field value (e.g., same last_seen).
        """
        assert self.days is not None
        assert self.dtfield is not None

        cutoff = timezone.now() - timedelta(days=self.days)
        queryset = self.model.objects.filter(**{f"{self.dtfield}__lt": cutoff})

        if self.project_id:
            queryset = queryset.filter(project_id=self.project_id)  # type: ignore[misc]
        if self.organization_id:
            queryset = queryset.filter(organization_id=self.organization_id)  # type: ignore[misc]

        # Determine order field (strip leading '-' for descending)
        order_field = "id"
        if self.order_by:
            order_field = self.order_by.lstrip("-")

        # Use compound order_by for keyset pagination: (order_field, id)
        # This handles non-unique order fields correctly
        order_by_fields = [order_field, "id"] if order_field != "id" else ["id"]

        # For values_list tuples, map field index to field name for cursor
        def result_value_getter(item: tuple[Any, ...]) -> dict[str, Any]:
            if order_field == "id":
                return {"id": item[0]}
            return {"id": item[0], order_field: item[1]}

        values_qs: QuerySet[Any, tuple[Any, ...]] = queryset.values_list("id", order_field)
        wrapper = RangeQuerySetWrapper(
            values_qs,
            step=batch_size,
            order_by=order_by_fields,
            result_value_getter=result_value_getter,
        )

        for batch in itertools.batched(wrapper, chunk_size):
            yield tuple(item[0] for item in batch)
