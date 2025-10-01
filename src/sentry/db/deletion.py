from __future__ import annotations

import itertools
from collections.abc import Generator
from datetime import timedelta

from django.db import connections, router
from django.utils import timezone

from sentry.utils.query import RangeQuerySetWrapper


class BulkDeleteQuery:
    def __init__(
        self, model, project_id=None, organization_id=None, dtfield=None, days=None, order_by=None
    ):
        self.model = model
        self.project_id = int(project_id) if project_id else None
        self.organization_id = int(organization_id) if organization_id else None
        self.dtfield = dtfield
        self.days = int(days) if days is not None else None
        self.order_by = order_by
        self.using = router.db_for_write(model)

    def execute(self, chunk_size=10000):
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

    def _continuous_query(self, query):
        results = True
        cursor = connections[self.using].cursor()
        while results:
            cursor.execute(query)
            results = cursor.rowcount > 0

    def iterator(self, chunk_size=100, batch_size=10000) -> Generator[tuple[int, ...]]:
        assert self.days is not None
        assert self.dtfield is not None
        assert self.order_by in [self.dtfield, f"-{self.dtfield}"]

        cutoff = timezone.now() - timedelta(days=self.days)
        queryset = self.model.objects.filter(**{f"{self.dtfield}__lt": cutoff})

        if self.project_id:
            queryset = queryset.filter(project_id=self.project_id)
        if self.organization_id:
            queryset = queryset.filter(organization_id=self.organization_id)

        queryset = queryset.values_list("id", self.dtfield)

        if self.order_by[0] == "-":
            step = -batch_size
            order_field = self.order_by[1:]
        else:
            step = batch_size
            order_field = self.order_by

        wrapper = RangeQuerySetWrapper(
            queryset,
            step=step,
            order_by=order_field,
            override_unique_safety_check=True,
            result_value_getter=lambda item: item[1],
        )

        for batch in itertools.batched(wrapper, chunk_size):
            yield tuple(item[0] for item in batch)
