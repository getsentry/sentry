from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr


class Distribution(Model):
    __include_in_export__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    release = FlexibleForeignKey("sentry.Release")
    name = models.CharField(max_length=64)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_distribution"
        unique_together = (("release", "name"),)

    __repr__ = sane_repr("release", "name")
