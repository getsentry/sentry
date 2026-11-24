from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@cell_silo_model
class GroupBookmark(Model):
    """
    Identifies a bookmark relationship between a user and an
    aggregated event (Group).
    """

    __relocation_scope__ = RelocationScope.Excluded

    # Lookups by project use the unique index, which starts with `project`.
    project = FlexibleForeignKey("sentry.Project", related_name="bookmark_set", db_index=False)
    group = FlexibleForeignKey("sentry.Group", related_name="bookmark_set")
    # namespace related_name on User since we don't own the model
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE", db_index=False)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupbookmark"
        # composite index includes project for efficient queries
        unique_together = (("project", "user_id", "group"),)
        indexes = [models.Index(fields=["user_id", "group"], name="sentry_grpbookmark_user_group")]

    __repr__ = sane_repr("project_id", "group_id", "user_id")
