from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
)
from sentry.types.releaseactivity import CHOICES


@region_silo_only_model
class ReleaseActivity(Model):
    __relocation_scope__ = RelocationScope.Excluded

    release = FlexibleForeignKey("sentry.Release", db_index=True)
    type = BoundedPositiveIntegerField(null=False, choices=CHOICES)
    data = models.JSONField(default=dict)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releaseactivity"
