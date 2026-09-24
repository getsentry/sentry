from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@cell_silo_model
class GroupComment(Model):
    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group", db_index=False)
    project = FlexibleForeignKey("sentry.Project")
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    text = models.TextField()
    mentions = models.JSONField(default=list)
    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupcomment"
        indexes = [
            models.Index(fields=["group", "date_added", "id"]),
        ]

    __repr__ = sane_repr("group_id", "project_id", "user_id")
