from __future__ import absolute_import

from datetime import timedelta
from django.db import connections, router
from django.utils import timezone

from sentry.utils import db


class BulkDeleteQuery(object):
    def __init__(self, model, project_id=None, dtfield=None, days=None):
        self.model = model
        self.project_id = int(project_id) if project_id else None
        self.dtfield = dtfield
        self.days = int(days) if days is not None else None
        self.using = router.db_for_write(model)

    def execute_postgres(self, chunk_size=10000):
        quote_name = connections[self.using].ops.quote_name

        where = []
        if self.dtfield and self.days is not None:
            where.append("{} < now() - interval '{} days'".format(
                quote_name(self.dtfield),
                self.days,
            ))
        if self.project_id:
            where.append("project_id = {}".format(self.project_id))

        if where:
            where_clause = 'where {}'.format(' and '.join(where))
        else:
            where_clause = ''

        query = """
            delete from {table}
            where id = any(array(
                select id
                from {table}
                {where}
                limit {chunk_size}
            ));
        """.format(
            table=self.model._meta.db_table,
            chunk_size=chunk_size,
            where=where_clause,
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
            qs = qs.filter(
                **{'{}__lte'.format(self.dtfield): cutoff}
            )
        if self.project_id:
            if 'project' in self.model._meta.get_all_field_names():
                qs = qs.filter(project=self.project_id)
            else:
                qs = qs.filter(project_id=self.project_id)

        # XXX: we step through because the deletion collector will pull all
        # relations into memory
        exists = True
        while exists:
            exists = False
            for item in qs[:chunk_size].iterator():
                item.delete()
                exists = True

    def execute(self, chunk_size=10000):
        if db.is_postgres():
            self.execute_postgres(chunk_size)
        else:
            self.execute_generic(chunk_size)
