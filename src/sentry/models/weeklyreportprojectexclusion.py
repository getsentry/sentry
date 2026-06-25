from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.project import Project


@cell_silo_model
class WeeklyReportProjectExclusion(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey(Project, db_constraint=False)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_weeklyreportprojectexclusion"
        unique_together = ("project", "user_id")

    __repr__ = sane_repr("project_id", "user_id")
