from django.db import connections, models, router

from sentry.db.models import Model
from sentry.db.models.fields.bounded import BoundedBigIntegerField


class StringIndexer(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    key = models.CharField(max_length=200)
    value = BoundedBigIntegerField()

    class Meta:
        db_table = "sentry_stringindexer"
        app_label = "sentry"
        indexes = [
            models.Index(fields=["organization_id", "key"]),
            models.Index(fields=["organization_id", "value"]),
        ]

    @classmethod
    def get_next_values(cls):
        using = router.db_for_write(cls)
        connection = connections[using].cursor()

        connection.execute("SELECT nextval('stringindexer_value') from generate_series(1,10)")
        return connection.fetchall()
