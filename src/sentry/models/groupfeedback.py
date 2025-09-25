from __future__ import annotations

from django.conf import settings
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

    feedback = models.BooleanField()
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    group = FlexibleForeignKey("sentry.Group", null=True, on_delete=models.CASCADE)
    commit_sha = models.CharField(max_length=64, null=True)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupfeedback"
        constraints = [
            # Ensure at least one of commit_sha or group_id is provided
            models.CheckConstraint(
                condition=~models.Q(commit_sha__isnull=True, group_id__isnull=True),
                name="commit_sha_or_group_id_required",
            ),
            models.UniqueConstraint(
                fields=["project_id", "commit_sha", "group_id", "user_id"],
                condition=models.Q(commit_sha__isnull=False, group_id__isnull=False),
                name="unique_commit_group_feedback",
            ),
            models.UniqueConstraint(
                fields=["project_id", "commit_sha", "user_id"],
                condition=models.Q(commit_sha__isnull=False, group_id__isnull=True),
                name="unique_project_commit_feedback",
            ),
            models.UniqueConstraint(
                fields=["project_id", "group_id", "user_id"],
                condition=models.Q(commit_sha__isnull=True, group_id__isnull=False),
                name="unique_group_exclusion_feedback",
            ),
        ]

    __repr__ = sane_repr("project_id", "commit_sha", "group_id", "user_id", "feedback")
