from django.contrib.postgres.fields import JSONField
from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
)
from sentry.types.releaseactivity import CHOICES


@region_silo_only_model
class ReleaseActivity(Model):
    __include_in_export__ = False

    release = FlexibleForeignKey("sentry.Release", db_index=True)
    type = BoundedPositiveIntegerField(null=False, choices=CHOICES)
    data = JSONField(default=dict)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releaseactivity"
