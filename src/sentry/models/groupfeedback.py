from __future__ import annotations

from enum import Enum

from django.conf import settings
from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class GroupFeedbackType(Enum):
    USER_SUSPECT_COMMIT_FEEDBACK = 0


@region_silo_model
class GroupFeedback(DefaultFieldsModel):
    """
    This model supports multiple feedback patterns based on NULL combinations:

    **Suspect Commit Feedback:**
    - commit=commit_obj, group=group_obj: Feedback on specific commit for specific group
    - commit=commit_obj, group=NULL: Commit excluded from suspicion on groups project-wide
    - commit=NULL, group=group_obj: Group excluded from suspect commits entirely
    """

    __relocation_scope__ = RelocationScope.Excluded

    feedback = models.BooleanField()
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    group = FlexibleForeignKey("sentry.Group", null=True, on_delete=models.CASCADE)
    commit = FlexibleForeignKey("sentry.Commit", null=True, on_delete=models.CASCADE)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    source = models.PositiveSmallIntegerField(
        choices=(
            (
                GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
                "User Submitted Suspect Commit Feedback",
            ),
        )
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupfeedback"
        constraints = [
            # Ensure at least one of commit or group is provided
            models.CheckConstraint(
                condition=~models.Q(commit__isnull=True, group__isnull=True),
                name="commit_or_group_required",
            ),
            # User feedback constraints: one feedback per user per context
            models.UniqueConstraint(
                fields=["project", "commit", "group", "user_id"],
                condition=models.Q(
                    commit__isnull=False, group__isnull=False, user_id__isnull=False
                ),
                name="unique_user_commit_group_feedback",
            ),
            models.UniqueConstraint(
                fields=["project", "commit", "user_id"],
                condition=models.Q(commit__isnull=False, group__isnull=True, user_id__isnull=False),
                name="unique_user_project_commit_feedback",
            ),
            models.UniqueConstraint(
                fields=["project", "group", "user_id"],
                condition=models.Q(commit__isnull=True, group__isnull=False, user_id__isnull=False),
                name="unique_user_group_exclusion_feedback",
            ),
        ]

    __repr__ = sane_repr("project", "group", "commit", "user_id", "feedback", "source")
