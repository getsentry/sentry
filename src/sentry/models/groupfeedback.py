from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_model
class GroupFeedback(DefaultFieldsModel):
    """
    This model supports multiple feedback patterns based on NULL combinations:

    **Suspect Commit Feedback:**
    - commit_sha="abc123", group_id=456: Feedback on specific commit for specific group
    - commit_sha="abc123", group_id=NULL: Commit excluded from suspicion on groups project-wide
    - commit_sha=NULL, group_id=456: Group excluded from suspect commits entirely

    **User vs System Feedback:**
    - user_id=123: User feedback
    - user_id=NULL: System feedback
    """

    __relocation_scope__ = RelocationScope.Excluded

    project_id = FlexibleForeignKey("sentry.Project")
    commit_sha = models.CharField(max_length=64, null=True)
    group_id = FlexibleForeignKey("sentry.Group", null=True)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")

    feedback_type = models.CharField(
        max_length=20,
        choices=[
            ("pos", "Positive"),
            ("neg", "Negative"),
        ],
    )

    def save(self, *args, **kwargs):
        if not self.commit_sha and not self.group_id:
            raise ValidationError("Either commit_sha or group_id must be provided")
        super().save(*args, **kwargs)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupfeedback"
        unique_together = [("project_id", "commit_sha", "group_id", "user_id", "feedback_type")]

    __repr__ = sane_repr("project_id", "commit_sha", "group_id", "user_id", "feedback_type")
