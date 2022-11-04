from django.db import models
from django.utils import timezone

from sentry.constants import MAX_DISTRIBUTION_NAME_LENGTH
from sentry.db.models import (
    BoundedBigIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)


@region_silo_only_model
class Distribution(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    release = FlexibleForeignKey("sentry.Release")
    name = models.CharField(max_length=MAX_DISTRIBUTION_NAME_LENGTH)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_distribution"
        unique_together = (("release", "name"),)

    __repr__ = sane_repr("release", "name")
