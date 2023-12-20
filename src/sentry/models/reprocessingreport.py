from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr


@region_silo_only_model
class ReprocessingReport(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    event_id = models.CharField(max_length=32, null=True)
    datetime = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_reprocessingreport"
        unique_together = (("project", "event_id"),)

    __repr__ = sane_repr("project_id")
