from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class SmartAssignmentTrigger(models.TextChoices):
    """What caused us to make a prediction for this issue.

    Recorded on the result row so evaluation can separate predictions made from a
    clean pre-outcome signal (`PR_CREATED`) from ones triggered by the very action
    they're scored against (`ASSIGNMENT`, `RESOLUTION`), which can be biased toward
    the actor. Not tied to `ActivityType`: predictions may be triggered from other
    sources (e.g. new issues via post_process) in the future.
    """

    PR_CREATED = "pr_created"
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
    result, and later annotated with who the issue actually belonged to (the
    assignee, or a user who resolved it) so we can evaluate prediction quality
    offline.
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

    # What first triggered the prediction. Predictions are deduped to one per group,
    # so this reflects the earliest trigger.
    trigger = models.CharField(max_length=64, choices=SmartAssignmentTrigger.choices)
    status = models.CharField(
        max_length=32,
        choices=SmartAssignmentStatus.choices,
        default=SmartAssignmentStatus.PENDING,
        db_default=SmartAssignmentStatus.PENDING,
    )

    # The full delivered `AssigneeVerdict` (ranked candidates), and the top pick
    # resolved to a Sentry user, denormalized so evaluation can compare it directly
    # against `actual_assignee_user_id`. Null when the agent named no one or we
    # couldn't map the top pick's identifier to a user in the org (the raw
    # identifier string is still recoverable from `verdict`).
    verdict = models.JSONField(null=True)
    predicted_assignee_user_id = HybridCloudForeignKey(
        "sentry.User", null=True, on_delete="SET_NULL"
    )

    # Ground truth: who the issue actually belonged to. Either an explicit assignee
    # (user and/or team -- a team assignee still lets us score whether our pick is
    # on the right team), or, for a user-driven resolution, the resolver, whom we
    # assume should have been the assignee. `ground_truth_source` records which
    # outcome produced the label so the resolution-inferred assumption can be
    # evaluated separately.
    actual_assignee_user_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    actual_assignee_team = FlexibleForeignKey(
        "sentry.Team", null=True, on_delete=models.SET_NULL, related_name="+"
    )
    ground_truth_source = models.CharField(
        max_length=64, null=True, choices=SmartAssignmentTrigger.choices
    )
    ground_truth_at = models.DateTimeField(null=True)

    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_smartassignmentresult"
        constraints = [
            # Only allow one pending prediction per issue.
            # Code currently disables running smart assignment again, but we might
            # want to re-run if the user rejects our first attempt, etc.
            models.UniqueConstraint(
                fields=["group"],
                condition=models.Q(status=SmartAssignmentStatus.PENDING),
                name="seer_smartassign_unique_active_group",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "date_added"]),
            models.Index(fields=["status"]),
        ]

    __repr__ = sane_repr("organization_id", "group_id", "trigger", "status")
