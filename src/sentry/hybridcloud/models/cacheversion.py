from typing import Mapping

from django.db import models, router, transaction

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, cell_silo_model, control_silo_model
from sentry.db.postgres.transactions import enforce_constraints


class CacheVersionBase(Model):
    class Meta:
        abstract = True

    keyname = models.CharField(max_length=200, null=False, unique=True)
    version = models.PositiveBigIntegerField(null=False, default=0)

    @classmethod
    def incr_version(cls, key: str) -> int:
        with enforce_constraints(transaction.atomic(router.db_for_write(cls))):
            obj, created = cls.objects.select_for_update().get_or_create(
                keyname=key, defaults=dict(version=1)
            )
            if created:
                return obj.version

            obj.version += 1
            obj.save(update_fields=["version"])
            return obj.version

    @classmethod
    def get_version_map(cls, keys: list[str]) -> Mapping[str, int]:
        return {
            row[0]: row[1]
            for row in cls.objects.filter(keyname__in=keys).values_list("keyname", "version")
        }


@cell_silo_model
class CellCacheVersion(CacheVersionBase):
    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_regioncacheversion"


@control_silo_model
class ControlCacheVersion(CacheVersionBase):
    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_controlcacheversion"
