from django.db import models
from django.utils import timezone

from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr


class ReprocessingReport(Model):
    __core__ = False

    project = FlexibleForeignKey("sentry.Project")
    event_id = models.CharField(max_length=32, null=True)
    datetime = models.DateTimeField(default=timezone.now)

    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_reprocessingreport"
        unique_together = (("project", "event_id"),)

    __repr__ = sane_repr("project_id")
