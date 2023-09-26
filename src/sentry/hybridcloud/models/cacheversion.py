from django.db import models

from sentry.db.models import Model, region_silo_only_model


class CacheVersionBase(Model):
    class Meta:
        abstract = True

    key = models.CharField(max_length=64, null=False, unique=True)
    version = models.PositiveBigIntegerField(null=False)


@region_silo_only_model
class RegionCacheVersion(CacheVersionBase):
    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_regioncacheversion"
