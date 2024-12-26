import logging
from typing import ClassVar, Self

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_model
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.db.models.manager.base import BaseManager
from sentry.sentry_metrics.configuration import MAX_INDEXED_COLUMN_LENGTH, UseCaseKey

logger = logging.getLogger(__name__)

from collections.abc import Mapping


class BaseIndexer(Model):
    string = models.CharField(max_length=MAX_INDEXED_COLUMN_LENGTH)
    organization_id = BoundedBigIntegerField()
    date_added = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    retention_days = models.IntegerField(default=90)

    objects: ClassVar[BaseManager[Self]] = BaseManager(
        cache_fields=("pk",), cache_ttl=settings.SENTRY_METRICS_INDEXER_CACHE_TTL
    )

    class Meta:
        abstract = True


@region_silo_model
class StringIndexer(BaseIndexer):
    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        db_table = "sentry_stringindexer"
        app_label = "sentry"
        constraints = [
            models.UniqueConstraint(fields=["string", "organization_id"], name="unique_org_string"),
        ]


@region_silo_model
class PerfStringIndexer(BaseIndexer):
    __relocation_scope__ = RelocationScope.Excluded
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


IndexerTable = type[BaseIndexer]

TABLE_MAPPING: Mapping[UseCaseKey, IndexerTable] = {
    UseCaseKey.RELEASE_HEALTH: StringIndexer,
    UseCaseKey.PERFORMANCE: PerfStringIndexer,
}
