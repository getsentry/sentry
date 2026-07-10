from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class SmartAssignmentTrigger(models.TextChoices):
    """What event caused us to make a prediction for this issue.

    Recorded so evaluation can separate predictions made before any human touched
    the issue (`NEW_ISSUE`, `SOLUTION_COMPLETED`) from ones triggered by the very
    action they're scored against (`ASSIGNMENT`, `RESOLUTION`), which can be biased
    toward the actor.
    """

    NEW_ISSUE = "new_issue"
    SOLUTION_COMPLETED = "solution_completed"
    ASSIGNMENT = "assignment"
    RESOLUTION = "resolution"


class SmartAssignmentStatus(models.TextChoices):
    PENDING = "pending"
    COMPLETED = "completed"
    ERROR = "error"


@cell_silo_model
class SeerSmartAssignmentResult(DefaultFieldsModel):
    """One smart-assignment prediction for a single issue, plus the eventual
    ground truth.

    Written when a prediction is triggered (one row per group, enforced by the
    unique constraint), filled in with the agent's verdict when Seer delivers the
    result, and later annotated with who actually got assigned / resolved the
    issue so we can evaluate prediction quality offline.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    group = FlexibleForeignKey("sentry.Group", on_delete=models.CASCADE)

    # The Seer run that produced (or is producing) the verdict. Null until the run
    # mirror exists; SET_NULL so run cleanup doesn't drop the result record.
    result_seer_run = FlexibleForeignKey(
        "seer.SeerRun",
        on_delete=models.SET_NULL,
        null=True,
        related_name="smart_assignment_results",
    )

    trigger = models.CharField(max_length=64, choices=SmartAssignmentTrigger.choices)
    status = models.CharField(
        max_length=32,
        choices=SmartAssignmentStatus.choices,
        default=SmartAssignmentStatus.PENDING,
        db_default=SmartAssignmentStatus.PENDING,
    )

    # The full delivered `AssigneeVerdict` (ranked candidates), and the top pick's
    # identifier denormalized for querying.
    verdict = models.JSONField(null=True)
    predicted_identifier = models.TextField(null=True)

    # Ground truth captured from later assignment / resolution activity.
    actual_assignee_user_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    actual_resolver_user_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    assigned_at = models.DateTimeField(null=True)
    resolved_at = models.DateTimeField(null=True)

    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_smartassignmentresult"
        constraints = [
            models.UniqueConstraint(fields=["group"], name="seer_smartassign_unique_group"),
        ]
        indexes = [
            models.Index(fields=["organization", "date_added"]),
            models.Index(fields=["status"]),
        ]

    __repr__ = sane_repr("organization_id", "group_id", "trigger", "status")
