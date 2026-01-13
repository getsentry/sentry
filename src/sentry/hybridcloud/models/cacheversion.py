from django.db import models, router, transaction

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, control_silo_model, region_silo_model


class CacheVersionBase(Model):
    class Meta:
        abstract = True

    key = models.CharField(max_length=64, null=False, unique=True)
    version = models.PositiveBigIntegerField(null=False, default=0)

    @classmethod
    def incr_version(cls, key: str) -> int:
        with transaction.atomic(router.db_for_write(cls)):
            obj, created = cls.objects.select_for_update().get_or_create(
                key=key, defaults=dict(version=1)
            )
            if created:
                return obj.version

            obj.version += 1
            obj.save(update_fields=["version"])
            return obj.version

    @classmethod
    def get_versions(cls, keys: list[str]) -> list[int]:
        return list(cls.objects.filter(key__in=keys).values_list("version", flat=True))


@region_silo_model
class RegionCacheVersion(CacheVersionBase):
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
