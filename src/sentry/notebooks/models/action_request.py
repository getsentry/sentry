from __future__ import annotations

from typing import Any

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class NotebookActionRequestState(models.TextChoices):
    SUGGESTED = "suggested", "Suggested"
    APPLIED = "applied", "Applied"
    FAILED = "failed", "Failed"
    SUPERSEDED = "superseded", "Superseded"
    WITHDRAWN = "withdrawn", "Withdrawn"


class NotebookActionRequestAnchorType(models.TextChoices):
    BLOCK = "block", "Block"
    HYPOTHESIS = "hypothesis", "Hypothesis"


@cell_silo_model
class NotebookActionRequest(DefaultFieldsModel):
    """A next step a producer suggested, optionally with a typed action."""

    __relocation_scope__ = RelocationScope.Excluded

    notebook = FlexibleForeignKey(
        "notebooks.Notebook",
        on_delete=models.CASCADE,
        related_name="action_requests",
        # The unique constraint leads with notebook, so it serves per-notebook reads.
        db_index=False,
    )
    # The producer's key; a later request with the same key updates this row.
    key = models.CharField(max_length=64)
    producer_revision = BoundedPositiveIntegerField()
    # At most one live request is the primary next step.
    primary = models.BooleanField(default=False, db_default=False)
    anchor_type = models.CharField(
        max_length=32, choices=NotebookActionRequestAnchorType.choices, null=True
    )
    anchor_id = models.CharField(max_length=128, null=True)
    title = models.CharField(max_length=200)
    rationale = models.TextField()
    impact = models.TextField(null=True)
    action_kind = models.CharField(max_length=64, null=True)
    action_payload: models.Field[dict[str, Any] | None, dict[str, Any] | None] = models.JSONField(
        null=True
    )
    state = models.CharField(
        max_length=32,
        choices=NotebookActionRequestState.choices,
        default=NotebookActionRequestState.SUGGESTED,
        db_default=NotebookActionRequestState.SUGGESTED,
    )
    # Why the producer withdrew the request.
    reason = models.TextField(null=True)
    applied_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    date_applied = models.DateTimeField(null=True)
    # What the apply did, for the activity feed. Depends on the action kind.
    applied_details: models.Field[dict[str, Any] | None, dict[str, Any] | None] = models.JSONField(
        null=True
    )
    error: models.Field[dict[str, Any] | None, dict[str, Any] | None] = models.JSONField(null=True)
    # The request_id of the re-check or re-run Sentry last sent Seer for this request.
    followup_request_id = models.UUIDField(null=True)

    class Meta:
        app_label = "notebooks"
        db_table = "notebooks_notebookactionrequest"
        constraints = [
            models.UniqueConstraint(
                fields=["notebook", "key"], name="notebook_unique_action_request_key"
            )
        ]

    __repr__ = sane_repr("notebook_id", "key", "producer_revision", "state")
