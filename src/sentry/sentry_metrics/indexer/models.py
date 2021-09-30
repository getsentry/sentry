from typing import Any

from django.db import connections, models, router

from sentry.db.models import Model
from sentry.db.models.fields.bounded import BoundedBigIntegerField


class MetricsKeyIndexer(Model):  # type: ignore
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField()
    string = models.CharField(max_length=200)

    class Meta:
        db_table = "sentry_metricskeyindexer"
        app_label = "sentry"
        constraints = [
            models.UniqueConstraint(fields=["organization_id", "string"], name="unique_org_string"),
        ]

    @classmethod
    def get_next_values(cls, num: int) -> Any:
        using = router.db_for_write(cls)
        connection = connections[using].cursor()

        connection.execute(
            "SELECT nextval('sentry_metricskeyindexer_id_seq') from generate_series(1,%s)", [num]
        )
        return connection.fetchall()
