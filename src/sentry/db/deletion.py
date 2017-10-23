from __future__ import absolute_import

from uuid import uuid4

from datetime import timedelta
from django.db import connections, router
from django.utils import timezone

from sentry.utils import db


class BulkDeleteQuery(object):
    def __init__(self, model, project_id=None, dtfield=None, days=None, order_by=None):
        self.model = model
        self.project_id = int(project_id) if project_id else None
        self.dtfield = dtfield
        self.days = int(days) if days is not None else None
        self.order_by = order_by
        self.using = router.db_for_write(model)

    def execute_postgres(self, chunk_size=10000):
        quote_name = connections[self.using].ops.quote_name

        where = []
        if self.dtfield and self.days is not None:
            where.append(
                "{} < '{}'::timestamptz".format(
                    quote_name(self.dtfield),
                    (timezone.now() - timedelta(days=self.days)).isoformat(),
                    self.days,
                )
            )
        if self.project_id:
            where.append("project_id = {}".format(self.project_id))

        if where:
            where_clause = 'where {}'.format(' and '.join(where))
        else:
            where_clause = ''

        if self.order_by:
            if self.order_by[0] == '-':
                direction = 'desc'
                order_field = self.order_by[1:]
            else:
                direction = 'asc'
                order_field = self.order_by
            order_clause = 'order by {} {}'.format(
                quote_name(order_field),
                direction,
            )
        else:
            order_clause = ''

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

    def execute_generic(self, chunk_size=100):
        qs = self.model.objects.all()

        if self.days:
            cutoff = timezone.now() - timedelta(days=self.days)
            qs = qs.filter(**{'{}__lte'.format(self.dtfield): cutoff})
        if self.project_id:
            if 'project' in self.model._meta.get_all_field_names():
                qs = qs.filter(project=self.project_id)
            else:
                qs = qs.filter(project_id=self.project_id)

        return self._continuous_generic_query(qs, chunk_size)

    def execute_sharded(self, total_shards, shard_id, chunk_size=100):
        assert total_shards > 1
        assert shard_id < total_shards
        qs = self.model.objects.all().extra(
            where=[
                'id %% {total_shards} = {shard_id}'.format(
                    total_shards=total_shards,
                    shard_id=shard_id,
                )
            ]
        )

        if self.days:
            cutoff = timezone.now() - timedelta(days=self.days)
            qs = qs.filter(**{'{}__lte'.format(self.dtfield): cutoff})
        if self.project_id:
            if 'project' in self.model._meta.get_all_field_names():
                qs = qs.filter(project=self.project_id)
            else:
                qs = qs.filter(project_id=self.project_id)

        return self._continuous_generic_query(qs, chunk_size)

    def _continuous_generic_query(self, query, chunk_size):
        # XXX: we step through because the deletion collector will pull all
        # relations into memory
        exists = True
        while exists:
            exists = False
            for item in query[:chunk_size].iterator():
                item.delete()
                exists = True

    def execute(self, chunk_size=10000):
        if db.is_postgres():
            self.execute_postgres(chunk_size)
        else:
            self.execute_generic(chunk_size)

    def iterator(self, chunk_size=100):
        assert db.is_postgres()

        dbc = connections[self.using]
        quote_name = dbc.ops.quote_name

        where = []
        if self.dtfield and self.days is not None:
            where.append(
                "{} < '{}'::timestamptz".format(
                    quote_name(self.dtfield),
                    (timezone.now() - timedelta(days=self.days)).isoformat(),
                    self.days,
                )
            )
        if self.project_id:
            where.append("project_id = {}".format(self.project_id))

        if where:
            where_clause = 'where {}'.format(' and '.join(where))
        else:
            where_clause = ''

        if self.order_by:
            if self.order_by[0] == '-':
                direction = 'desc'
                order_field = self.order_by[1:]
            else:
                direction = 'asc'
                order_field = self.order_by
            order_clause = 'order by {} {}'.format(
                quote_name(order_field),
                direction,
            )
        else:
            order_clause = ''

        query = """
            select id
            from {table}
            {where}
            {order}
        """.format(
            table=self.model._meta.db_table,
            where=where_clause,
            order=order_clause,
        )

        # Explicitly use a named cursor so we can read rows
        # from postgres incrementally without pulling them all
        # into memory and we can iterate one big query for
        # all rows instead of a bunch of smaller ones
        with dbc.get_new_connection(dbc.get_connection_params()) as conn:
            with conn.cursor(uuid4().hex) as cursor:
                cursor.execute(query)
                chunk = []
                for row in cursor:
                    chunk.append(row[0])
                    if len(chunk) == chunk_size:
                        yield tuple(chunk)
                        chunk = []
                if chunk:
                    yield tuple(chunk)
