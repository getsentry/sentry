from typing import Any

from django.db import connections, models, router

from sentry.db.models import BaseModel
from sentry.db.models.fields.bounded import BoundedBigIntegerField


class MetricsKeyIndexer(BaseModel):  # type: ignore
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    key = models.CharField(max_length=200, primary_key=True)
    value = BoundedBigIntegerField()

    class Meta:
        db_table = "sentry_metricskeyindexer"
        app_label = "sentry"
        indexes = [
            models.Index(fields=["organization_id", "key"]),
            models.Index(fields=["organization_id", "value"]),
        ]

    @classmethod
    def get_next_values(cls, num: int) -> Any:
        using = router.db_for_write(cls)
        connection = connections[using].cursor()

        connection.execute(
            "SELECT nextval('metricskeyindexer_value') from generate_series(1,%s)", [num]
        )
        return connection.fetchall()

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.value:
            using = router.db_for_write(self.__class__)
            connection = connections[using].cursor()
            connection.execute("SELECT nextval('metricskeyindexer_value')")
            next_val = connection.fetchone()[0]
            self.value = next_val

        super().save(*args, **kwargs)
