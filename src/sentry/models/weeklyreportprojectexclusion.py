from django.conf import settings

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.project import Project


@cell_silo_model
class WeeklyReportProjectExclusion(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey(Project)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_weeklyreportprojectexclusion"
        unique_together = ("project", "user_id")

    __repr__ = sane_repr("project_id", "user_id")
