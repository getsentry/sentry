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
            # Partial unique index: at most one *in-flight* (PENDING) prediction per
            # issue. This enforces integrity only -- concurrent triggers can't race
            # two runs for the same group (the second INSERT trips this, and we treat
            # the IntegrityError as a dedup no-op in trigger._dispatch). It does NOT
            # enforce "predict once per issue, ever": once a run finishes
            # (COMPLETED/ERROR) it no longer blocks a new row, so re-runs and full
            # attempt history are possible.
            #
            # The current predict-once-ever behavior is a *policy* enforced in app
            # code (see maybe_trigger_smart_assignment's existence check), kept out of
            # the DB on purpose. To enable re-runs later, relax that guard (e.g. skip
            # only when a PENDING row exists, or add a cooldown on the latest row) --
            # no migration needed, since this constraint already permits extra rows.
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
