from __future__ import absolute_import

from datetime import timedelta
from django.db import connections, router
from django.utils import timezone

from sentry.utils import db

BULK_DELETE_QUERY = """
DELETE FROM {table}
WHERE id IN (
  SELECT id
  FROM {table}
  {where}
  LIMIT {chunk_size}
);
""".strip()

BULK_DELETE_DATE_QUERY = """
DELETE FROM {table}
WHERE {field} < now() - interval '{chunk} seconds'
{where};
""".strip()


class BulkDeleteQuery(object):
    def __init__(self, model, project_id=None, dtfield=None, days=None):
        self.model = model
        self.project_id = int(project_id) if project_id else None
        self.dtfield = dtfield
        self.days = int(days) if days is not None else None
        self.using = router.db_for_write(model)

    def execute_postgres(self, chunk_size=10000, chunk_delta=None):
        if self.dtfield and self.days is not None:
            return self.execute_postgres_date(chunk_delta)

        where = []
        if self.project_id:
            where.append("project_id={}".format(self.project_id))

        if where:
            where_clause = 'WHERE {}'.format(' AND '.join(where))
        else:
            where_clause = ''

        query = BULK_DELETE_QUERY.format(
            table=self.model._meta.db_table,
            chunk_size=chunk_size,
            where=where_clause,
        )

        return self._continuous_query(query)

    def execute_postgres_date(self, chunk_delta=None):
        if chunk_delta is None:
            chunk_delta = timedelta(hours=1)

        connection = connections[self.using]
        dtfield_sql = connection.ops.quote_name(self.dtfield)

        qs = self.model.objects.all()

        where_clause = ''
        if self.project_id:
            where_clause = 'AND project_id={}'.format(self.project_id)
            if 'project' in self.model._meta.get_all_field_names():
                qs = qs.filter(project=self.project_id)
            else:
                qs = qs.filter(project_id=self.project_id)

        try:
            oldest = qs.order_by(self.dtfield).values_list(self.dtfield, flat=True)[0]
        except IndexError:
            # No rows at all
            return

        now = timezone.now()
        cutoff_delta = timedelta(days=self.days)
        cutoff = now - cutoff_delta

        if oldest > cutoff:
            # Nothing is old enough to be deleted
            return

        # Grab the actual delta between now and the oldest event we have,
        # and we want to iterate in chunks from oldest to newest by
        # the chunk_delta interval until we get to the cutoff delta
        #
        # e.g if days=10, chunk_delta=1 day, max_delta=12 days, this means
        # we'll execute 2 queries. One for < 11 days, then < 10 days
        delta = now - oldest

        cursor = connection.cursor()

        while 1:
            delta = max(delta - chunk_delta, cutoff_delta)

            cursor.execute(BULK_DELETE_DATE_QUERY.format(
                table=self.model._meta.db_table,
                field=dtfield_sql,
                chunk=int(delta.total_seconds()),
                where=where_clause,
            ))

            if delta == cutoff_delta:
                break

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
            qs = qs.filter(
                **{'{}__lte'.format(self.dtfield): cutoff}
            )
        if self.project_id:
            if 'project' in self.model._meta.get_all_field_names():
                qs = qs.filter(project=self.project_id)
            else:
                qs = qs.filter(project_id=self.project_id)

        return self._continuous_generic_query(qs, chunk_size)

    def execute_sharded(self, total_shards, shard_id, chunk_size=100):
        assert total_shards > 1
        assert shard_id < total_shards
        qs = self.model.objects.all().extra(where=[
            'id %% {total_shards} = {shard_id}'.format(
                total_shards=total_shards,
                shard_id=shard_id,
            )
        ])

        if self.days:
            cutoff = timezone.now() - timedelta(days=self.days)
            qs = qs.filter(
                **{'{}__lte'.format(self.dtfield): cutoff}
            )
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

    def execute(self, chunk_size=10000, chunk_delta=None):
        if chunk_delta is None:
            chunk_delta = timedelta(hours=1)

        if db.is_postgres():
            self.execute_postgres(chunk_size, chunk_delta)
        else:
            self.execute_generic(chunk_size)
