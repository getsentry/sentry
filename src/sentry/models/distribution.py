from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    ExternalDataMappingField,
    ExternalMappingType,
    FlexibleForeignKey,
    Model,
    cell_silo_model,
    sane_repr,
)


@cell_silo_model
class Distribution(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = ExternalDataMappingField(
        BoundedBigIntegerField(db_index=True),
        mapping_type=ExternalMappingType.POSTGRES,
        description="ID of the Organization the release distribution belongs to",
    )
    release = FlexibleForeignKey("sentry.Release")
    name = models.CharField(max_length=64)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_distribution"
        unique_together = (("release", "name"),)

    __repr__ = sane_repr("release", "name")
