from typing import List

from django.db import models, router, transaction
from django.db.models import F

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_only_model
from sentry.db.postgres.transactions import enforce_constraints


class CacheVersionBase(Model):
    class Meta:
        abstract = True

    key = models.CharField(max_length=64, null=False, unique=True)
    version = models.PositiveBigIntegerField(null=False, default=0)

    @classmethod
    def incr_version(cls, key: str) -> int:
        with enforce_constraints(transaction.atomic(router.db_for_write(cls))):
            cls.objects.create_or_update(
                key=key, defaults=dict(version=1), values=dict(version=F("version") + 1)
            )
            return cls.objects.filter(key=key).values("version").first()["version"]

    @classmethod
    def get_versions(cls, keys: List[str]) -> List[int]:
        return list(cls.objects.filter(key__in=keys).values_list("version", flat=True))


@region_silo_only_model
class RegionCacheVersion(CacheVersionBase):
    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_regioncacheversion"
