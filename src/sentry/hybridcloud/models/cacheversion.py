from django.db import models, router, transaction
from django.db.models import F

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, control_silo_model, region_silo_model
from sentry.db.postgres.transactions import enforce_constraints
from sentry.options.rollout import in_random_rollout


class CacheVersionBase(Model):
    class Meta:
        abstract = True

    key = models.CharField(max_length=64, null=False, unique=True)
    version = models.PositiveBigIntegerField(null=False, default=0)

    @classmethod
    def incr_version(cls, key: str) -> int:
        if in_random_rollout("sentry.hybridcloud.cacheversion.rollout"):
            with enforce_constraints(transaction.atomic(router.db_for_write(cls))):
                if random.random() < 0.01:
                    logger.info("cacheversion.incr_version", extra={"key": key})
                obj, created = cls.objects.select_for_update().get_or_create(
                    key=key, defaults=dict(version=1)
                )
                if created:
                    return obj.version

                obj.version += 1
                obj.save(update_fields=["version"])
                return obj.version

        with enforce_constraints(transaction.atomic(router.db_for_write(cls))):
            cls.objects.create_or_update(
                key=key, defaults=dict(version=1), values=dict(version=F("version") + 1)
            )
            return cls.objects.get(key=key).version

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
