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


class InvestigationActionRequestState(models.TextChoices):
    SUGGESTED = "suggested", "Suggested"
    APPLIED = "applied", "Applied"
    FAILED = "failed", "Failed"
    SUPERSEDED = "superseded", "Superseded"
    WITHDRAWN = "withdrawn", "Withdrawn"


class InvestigationActionRequestAnchorType(models.TextChoices):
    BLOCK = "block", "Block"
    HYPOTHESIS = "hypothesis", "Hypothesis"


@cell_silo_model
class InvestigationActionRequest(DefaultFieldsModel):
    """A next step Seer asked for during or after a run, optionally with a typed action."""

    __relocation_scope__ = RelocationScope.Excluded

    investigation = FlexibleForeignKey(
        "investigations.Investigation",
        on_delete=models.CASCADE,
        related_name="action_requests",
        # The unique constraint leads with investigation, so it serves per-investigation reads.
        db_index=False,
    )
    # Seer's stable key; a later request with the same key updates this row.
    key = models.CharField(max_length=64)
    report_revision = BoundedPositiveIntegerField()
    # The post-run suggested next step. At most one live request is primary.
    primary = models.BooleanField(default=False, db_default=False)
    anchor_type = models.CharField(
        max_length=32, choices=InvestigationActionRequestAnchorType.choices, null=True
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
        choices=InvestigationActionRequestState.choices,
        default=InvestigationActionRequestState.SUGGESTED,
        db_default=InvestigationActionRequestState.SUGGESTED,
    )
    # Why Seer withdrew the request.
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
        app_label = "investigations"
        db_table = "investigations_investigationactionrequest"
        constraints = [
            models.UniqueConstraint(
                fields=["investigation", "key"],
                name="invest_unique_action_request_key",
            )
        ]

    __repr__ = sane_repr("investigation_id", "key", "report_revision", "state")
