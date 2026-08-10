from __future__ import annotations

from typing import Any
from uuid import uuid4

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class InvestigationCellExecutor(models.TextChoices):
    # Content persisted without an automated runner.
    MANUAL = "manual", "Manual"
    # Content or query results produced by the Seer code-mode runner.
    CODE_MODE = "code_mode", "Code mode"
    # Text content produced by the Seer text-generation runner.
    TEXT_GENERATION = "text_generation", "Text generation"


class InvestigationCellExecutionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    AWAITING_INPUT = "awaiting_input", "Awaiting input"
    STOPPING = "stopping", "Stopping"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


@cell_silo_model
class InvestigationCellExecution(DefaultFieldsModel):
    """An immutable attempt to produce a cell's content or query result."""

    __relocation_scope__ = RelocationScope.Excluded

    # Idempotency identity supplied by, or returned to, execution callers.
    request_id = models.UUIDField(default=uuid4, editable=False, unique=True)
    cell = FlexibleForeignKey(
        "investigations.InvestigationCell", on_delete=models.CASCADE, related_name="executions"
    )
    triggered_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    seer_run = FlexibleForeignKey(
        "seer.SeerRun", null=True, on_delete=models.SET_NULL, related_name="cell_executions"
    )

    executor = models.CharField(max_length=32, choices=InvestigationCellExecutor.choices)
    status = models.CharField(
        max_length=32,
        choices=InvestigationCellExecutionStatus.choices,
        default=InvestigationCellExecutionStatus.PENDING,
        db_default=InvestigationCellExecutionStatus.PENDING,
    )
    cell_version = BoundedPositiveIntegerField()

    # Immutable resolved inputs: parameter values plus exact upstream execution
    # execution IDs/hashes. This makes reruns reproducible even after the notebook changes.
    input_snapshot: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    input_fingerprint = models.CharField(max_length=64)

    result_schema_version = BoundedPositiveIntegerField(default=1, db_default=1)
    result = models.JSONField(null=True)
    error = models.JSONField(null=True)
    transcript = models.JSONField(default=list, db_default=[])
    transcript_truncated = models.BooleanField(default=False, db_default=False)
    started_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)

    # Immutable provenance for projects whose data contributed to this output.
    # Unlike an investigation's mutable project selection, these links are used
    # when enforcing access to already-persisted results.
    data_projects = models.ManyToManyField(
        "sentry.Project", through="investigations.InvestigationCellExecutionProject", blank=True
    )

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationcellexecution"
        indexes = [
            models.Index(fields=["cell", "-date_added"]),
            models.Index(fields=["cell", "status"]),
        ]

    __repr__ = sane_repr("cell_id", "executor", "status")


@cell_silo_model
class InvestigationCellExecutionProject(DefaultFieldsModel):
    """A project whose data contributed to one persisted cell output."""

    __relocation_scope__ = RelocationScope.Excluded

    execution = FlexibleForeignKey(
        "investigations.InvestigationCellExecution",
        on_delete=models.CASCADE,
        related_name="data_project_links",
    )
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationcellexecutionproject"
        constraints = [
            models.UniqueConstraint(
                fields=["execution", "project"],
                name="investigation_unique_execution_project",
            )
        ]
