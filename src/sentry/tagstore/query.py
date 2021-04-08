from django.db.models import sql
from django.db.models.query import QuerySet
from django.db.models.sql.constants import CURSOR

from sentry.db.models import BaseManager


class NoTransactionUpdateQuerySet(QuerySet):
    def update(self, **kwargs):
        """
        Updates all elements in the current QuerySet, setting all the given
        fields to the appropriate values.
        """
        # HACK(mattrobenolt): This is copy/pasted directly from
        # https://github.com/django/django/blob/stable/1.6.x/django/db/models/query.py#L482-L496
        # with 1 important change. It removes the `transaction.commit_on_success_unless_managed`
        # block. The effect of this is we now can perform a simple `UPDATE` query without
        # incurring the overhead of 4 statements and an explicit transaction. This is a safe
        # assumption made by Django, but we can forego it for performance.
        assert self.query.can_filter(), "Cannot update a query once a slice has been taken."
        self._for_write = True
        query = self.query.clone(sql.UpdateQuery)
        query.add_update_values(kwargs)
        rows = query.get_compiler(self.db).execute_sql(CURSOR)
        self._result_cache = None
        return rows

    update.alters_data = True


class TagStoreManager(BaseManager):
    def get_queryset(self):
        return NoTransactionUpdateQuerySet(self.model, using=self._db)
