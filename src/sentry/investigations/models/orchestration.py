from __future__ import annotations

from typing import Any

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class InvestigationOrchestrationPhase(models.TextChoices):
    INTAKE = "intake", "Intake"
    BROAD_SCAN = "broad_scan", "Broad scan"
    PLANNING = "planning", "Planning"
    INVESTIGATING = "investigating", "Investigating"
    JUDGING = "judging", "Judging"
    REPORTING = "reporting", "Reporting"
    METADATA = "metadata", "Metadata"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


class InvestigationOrchestrationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    AWAITING_INPUT = "awaiting_input", "Awaiting input"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


class InvestigationOrchestrationEventStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPLIED = "applied", "Applied"
    IGNORED = "ignored", "Ignored"
    FAILED = "failed", "Failed"


class InvestigationOrchestrationCommandStatus(models.TextChoices):
    ACCEPTED = "accepted", "Accepted"
    DISPATCHED = "dispatched", "Dispatched"
    ACKNOWLEDGED = "acknowledged", "Acknowledged"
    FAILED = "failed", "Failed"


@cell_silo_model
class InvestigationOrchestrationRun(DefaultFieldsModel):
    """Sentry's durable control-plane projection of one Seer investigation run."""

    __relocation_scope__ = RelocationScope.Excluded

    investigation = models.OneToOneField(
        "investigations.Investigation",
        on_delete=models.CASCADE,
        related_name="orchestration_run",
    )
    # This remains empty while Sentry has durably queued creation with Seer.
    seer_run = models.OneToOneField(
        "seer.SeerRun",
        null=True,
        on_delete=models.SET_NULL,
        related_name="investigation_orchestration_run",
    )
    schema_version = BoundedPositiveIntegerField(default=1, db_default=1)
    workflow_version = BoundedPositiveIntegerField(default=1, db_default=1)
    generation = BoundedPositiveIntegerField(default=1, db_default=1)
    phase = models.CharField(
        max_length=32,
        choices=InvestigationOrchestrationPhase.choices,
        default=InvestigationOrchestrationPhase.INTAKE,
        db_default=InvestigationOrchestrationPhase.INTAKE,
    )
    status = models.CharField(
        max_length=32,
        choices=InvestigationOrchestrationStatus.choices,
        default=InvestigationOrchestrationStatus.PENDING,
        db_default=InvestigationOrchestrationStatus.PENDING,
    )
    source: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    projection: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    notebook_revision = BoundedPositiveIntegerField(default=0, db_default=0)
    last_event_sequence = BoundedPositiveIntegerField(default=0, db_default=0)
    heartbeat_at = models.DateTimeField(null=True)
    error: models.Field[dict[str, Any] | None, dict[str, Any] | None] = models.JSONField(null=True)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationorchestrationrun"
        indexes = [
            models.Index(fields=["status", "heartbeat_at"]),
            models.Index(fields=["phase", "-date_updated"]),
        ]

    __repr__ = sane_repr("investigation_id", "seer_run_id", "phase", "status")


@cell_silo_model
class InvestigationOrchestrationEvent(DefaultFieldsModel):
    """A sequenced Seer event persisted before projection application."""

    __relocation_scope__ = RelocationScope.Excluded

    orchestration_run = FlexibleForeignKey(
        "investigations.InvestigationOrchestrationRun",
        on_delete=models.CASCADE,
        related_name="events",
    )
    event_id = models.UUIDField()
    sequence = BoundedPositiveIntegerField()
    type = models.CharField(max_length=64)
    payload: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    application_status = models.CharField(
        max_length=32,
        choices=InvestigationOrchestrationEventStatus.choices,
        default=InvestigationOrchestrationEventStatus.PENDING,
        db_default=InvestigationOrchestrationEventStatus.PENDING,
    )
    error: models.Field[dict[str, Any] | None, dict[str, Any] | None] = models.JSONField(null=True)
    applied_at = models.DateTimeField(null=True)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationorchestrationevent"
        constraints = [
            models.UniqueConstraint(
                fields=["orchestration_run", "event_id"],
                name="invest_orch_unique_event_id",
            ),
            models.UniqueConstraint(
                fields=["orchestration_run", "sequence"],
                name="invest_orch_unique_event_sequence",
            ),
        ]
        indexes = [models.Index(fields=["orchestration_run", "application_status", "sequence"])]

    __repr__ = sane_repr("orchestration_run_id", "sequence", "type")


@cell_silo_model
class InvestigationOrchestrationCommand(DefaultFieldsModel):
    """An idempotent user command accepted by Sentry for durable dispatch."""

    __relocation_scope__ = RelocationScope.Excluded

    orchestration_run = FlexibleForeignKey(
        "investigations.InvestigationOrchestrationRun",
        on_delete=models.CASCADE,
        related_name="commands",
    )
    request_id = models.UUIDField()
    actor_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    expected_workflow_version = BoundedPositiveIntegerField()
    resulting_workflow_version = BoundedPositiveIntegerField(null=True)
    type = models.CharField(max_length=64)
    payload: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    status = models.CharField(
        max_length=32,
        choices=InvestigationOrchestrationCommandStatus.choices,
        default=InvestigationOrchestrationCommandStatus.ACCEPTED,
        db_default=InvestigationOrchestrationCommandStatus.ACCEPTED,
    )
    error: models.Field[dict[str, Any] | None, dict[str, Any] | None] = models.JSONField(null=True)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationorchestrationcommand"
        constraints = [
            models.UniqueConstraint(
                fields=["orchestration_run", "request_id"],
                name="invest_orch_unique_command_request",
            )
        ]
        indexes = [models.Index(fields=["orchestration_run", "status", "date_added"])]

    __repr__ = sane_repr("orchestration_run_id", "request_id", "type", "status")
