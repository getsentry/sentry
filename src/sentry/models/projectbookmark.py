from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.project import Project


@region_silo_only_model
class ProjectBookmark(Model):
    """
    Identifies a bookmark relationship between a user and a project
    """

    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey(Project, blank=True, null=True, db_constraint=False)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE")
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectbookmark"
        unique_together = ("project", "user_id")

    __repr__ = sane_repr("project_id", "user_id")
