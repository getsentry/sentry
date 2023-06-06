import logging
from typing import Any

from django.conf import settings
from django.db import connections, models, router
from django.utils import timezone

from sentry.db.models import Model, region_silo_only_model
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.db.models.manager.base import BaseManager
from sentry.sentry_metrics.configuration import UseCaseKey

logger = logging.getLogger(__name__)

from typing import Mapping, Type


@region_silo_only_model
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


class BaseIndexer(Model):  # type: ignore
    string = models.CharField(max_length=200)
    organization_id = BoundedBigIntegerField()
    date_added = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    retention_days = models.IntegerField(default=90)

    objects = BaseManager(cache_fields=("pk",), cache_ttl=settings.SENTRY_METRICS_INDEXER_CACHE_TTL)  # type: ignore

    class Meta:
        abstract = True


@region_silo_only_model
class StringIndexer(BaseIndexer):
    __include_in_export__ = False

    class Meta:
        db_table = "sentry_stringindexer"
        app_label = "sentry"
        constraints = [
            models.UniqueConstraint(fields=["string", "organization_id"], name="unique_org_string"),
        ]


@region_silo_only_model
class PerfStringIndexer(BaseIndexer):
    __include_in_export__ = False
    use_case_id = models.CharField(max_length=120)

    class Meta:
        db_table = "sentry_perfstringindexer"
        app_label = "sentry"
        constraints = [
            models.UniqueConstraint(
                fields=["string", "organization_id", "use_case_id"],
                name="perf_unique_org_string_usecase",
            ),
        ]


IndexerTable = Type[BaseIndexer]

TABLE_MAPPING: Mapping[UseCaseKey, IndexerTable] = {
    UseCaseKey.RELEASE_HEALTH: StringIndexer,
    UseCaseKey.PERFORMANCE: PerfStringIndexer,
}
