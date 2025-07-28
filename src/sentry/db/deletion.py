from __future__ import annotations

import itertools
from collections.abc import Generator
from datetime import timedelta
from typing import Any
from uuid import uuid4

from django.db import connections, router
from django.utils import timezone


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

    def _is_group_model(self):
        """Check if the model is the Group model."""
        # Import here to avoid circular imports
        try:
            from sentry.models.group import Group
            return self.model is Group
        except ImportError:
            return False

    def _get_group_status_exclusions(self):
        """Get the group statuses that should be excluded from cleanup deletion."""
        try:
            from sentry.models.group import GroupStatus
            return [GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]
        except ImportError:
            return []

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

        # Exclude groups with deletion statuses from cleanup
        if self._is_group_model():
            excluded_statuses = self._get_group_status_exclusions()
            if excluded_statuses:
                status_list = ",".join(str(status) for status in excluded_statuses)
                where.append(f"status NOT IN ({status_list})")

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

    def iterator(self, chunk_size=100, batch_size=100000) -> Generator[tuple[int, ...]]:
        assert self.days is not None
        assert self.dtfield is not None and self.dtfield == self.order_by

        dbc = connections[self.using]
        quote_name = dbc.ops.quote_name

        position: object | None = None
        cutoff = timezone.now() - timedelta(days=self.days)

        with dbc.get_new_connection(dbc.get_connection_params()) as conn:
            conn.autocommit = False

            chunk = []

            completed = False
            while not completed:
                # We explicitly use a named cursor here so that we can read a
                # large quantity of rows from postgres incrementally, without
                # having to pull all rows into memory at once.
                with conn.cursor(uuid4().hex) as cursor:
                    where: list[tuple[str, list[Any]]] = [
                        (f"{quote_name(self.dtfield)} < %s", [cutoff])
                    ]

                    if self.project_id:
                        where.append(("project_id = %s", [self.project_id]))
                    if self.organization_id:
                        where.append(("organization_id = %s", [self.organization_id]))

                    # Exclude groups with deletion statuses from cleanup
                    if self._is_group_model():
                        excluded_statuses = self._get_group_status_exclusions()
                        if excluded_statuses:
                            status_placeholders = ",".join(["%s"] * len(excluded_statuses))
                            where.append((f"status NOT IN ({status_placeholders})", excluded_statuses))

                    if self.order_by[0] == "-":
                        direction = "desc"
                        order_field = self.order_by[1:]
                        if position is not None:
                            where.append((f"{quote_name(order_field)} <= %s", [position]))
                    else:
                        direction = "asc"
                        order_field = self.order_by
                        if position is not None:
                            where.append((f"{quote_name(order_field)} >= %s", [position]))

                    conditions, parameters = zip(*where)
                    parameters = list(itertools.chain.from_iterable(parameters))

                    query = """
                        select id, {order_field}
                        from {table}
                        where {conditions}
                        order by {order_field} {direction}
                        limit {batch_size}
                    """.format(
                        table=self.model._meta.db_table,
                        conditions=" and ".join(conditions),
                        order_field=quote_name(order_field),
                        direction=direction,
                        batch_size=batch_size,
                    )

                    cursor.execute(query, parameters)

                    i = 0
                    for i, row in enumerate(cursor, 1):
                        key, position = row
                        chunk.append(key)
                        if len(chunk) == chunk_size:
                            yield tuple(chunk)
                            chunk = []

                    # If we retrieved less rows than the batch size, there are
                    # no more rows remaining to delete and we can exit the
                    # loop.
                    if i < batch_size:
                        completed = True

                conn.commit()

            if chunk:
                yield tuple(chunk)
