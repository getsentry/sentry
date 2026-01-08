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
        assert self.days is not None
        assert self.dtfield is not None

        cutoff = timezone.now() - timedelta(days=self.days)
        queryset = self.model.objects.filter(**{f"{self.dtfield}__lt": cutoff})

        if self.project_id:
            queryset = queryset.filter(project_id=self.project_id)  # type: ignore[misc]
        if self.organization_id:
            queryset = queryset.filter(organization_id=self.organization_id)  # type: ignore[misc]

        order_field = "id"
        descending = False
        if self.order_by:
            if self.order_by.startswith("-"):
                descending = True
                order_field = self.order_by[1:]
            else:
                order_field = self.order_by

        step = -batch_size if descending else batch_size
        use_keyset = order_field not in ("id", "pk")
        order_by_fields = [order_field, "id"] if use_keyset else ["id"]

        def result_value_getter(item: tuple[Any, ...]) -> dict[str, Any]:
            if use_keyset:
                return {"id": item[0], order_field: item[1]}
            return {"id": item[0]}

        values_qs: QuerySet[Any, tuple[Any, ...]] = queryset.values_list("id", order_field)
        wrapper = RangeQuerySetWrapper(
            values_qs,
            step=step,
            order_by=order_by_fields,
            use_compound_keyset_pagination=use_keyset,
            result_value_getter=result_value_getter,
            query_timeout_retries=10,
        )

        for batch in itertools.batched(wrapper, chunk_size):
            yield tuple(item[0] for item in batch)
