from django.db import models, router, transaction

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, cell_silo_model, control_silo_model
from sentry.db.postgres.transactions import enforce_constraints


class CacheVersionBase(Model):
    class Meta:
        abstract = True

    # Deprecated - use keyname instead.
    key = models.CharField(max_length=64, null=False, unique=True)
    keyname = models.CharField(max_length=200, null=True, unique=True)
    version = models.PositiveBigIntegerField(null=False, default=0)

    @classmethod
    def incr_version(cls, key: str) -> int:
        with enforce_constraints(transaction.atomic(router.db_for_write(cls))):
            obj, created = cls.objects.select_for_update().get_or_create(
                key=key, defaults=dict(version=1, keyname=key)
            )
            if created:
                return obj.version

            obj.version += 1
            updated = ["version"]

            # Dual write keys to the new longer column
            if obj.keyname is None:
                obj.keyname = key
                updated.append("keyname")

            obj.save(update_fields=updated)
            return obj.version

    @classmethod
    def get_versions(cls, keys: list[str]) -> list[int]:
        return list(cls.objects.filter(key__in=keys).values_list("version", flat=True))


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
