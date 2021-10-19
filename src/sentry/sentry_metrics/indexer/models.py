from typing import Any

from django.conf import settings
from django.db import connections, models, router
from django.utils import timezone

from sentry.db.models import Model
from sentry.db.models.manager.base import BaseManager


class MetricsKeyIndexer(Model):  # type: ignore
    __include_in_export__ = False

    string = models.CharField(max_length=200)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=("pk", "string"), cache_ttl=settings.SENTRY_METRICS_INDEXER_CACHE_TTL)  # type: ignore

    class Meta:
        db_table = "sentry_metricskeyindexer"
        app_label = "sentry"
        constraints = [
            models.UniqueConstraint(fields=["string"], name="unique_string"),
        ]

    @classmethod
    def get_next_values(cls, num: int) -> Any:
        using = router.db_for_write(cls)
        connection = connections[using].cursor()

        connection.execute(
            "SELECT nextval('sentry_metricskeyindexer_id_seq') from generate_series(1,%s)", [num]
        )
        return connection.fetchall()
