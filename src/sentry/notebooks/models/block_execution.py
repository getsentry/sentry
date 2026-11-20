from __future__ import annotations

from typing import Any
from uuid import uuid4

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class NotebookBlockExecutor(models.TextChoices):
    CODE_MODE = "code_mode", "Code mode"
    TEXT_GENERATION = "text_generation", "Text generation"


class NotebookBlockExecutionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    AWAITING_INPUT = "awaiting_input", "Awaiting input"
    STOPPING = "stopping", "Stopping"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


TERMINAL_BLOCK_EXECUTION_STATUSES = (
    NotebookBlockExecutionStatus.COMPLETED,
    NotebookBlockExecutionStatus.FAILED,
    NotebookBlockExecutionStatus.CANCELLED,
)


@cell_silo_model
class NotebookBlockExecution(DefaultFieldsModel):
    """One attempt to produce a block's content or query result."""

    __relocation_scope__ = RelocationScope.Excluded

    request_id = models.UUIDField(default=uuid4, editable=False, unique=True)
    block = FlexibleForeignKey(
        "notebooks.NotebookBlock", on_delete=models.CASCADE, related_name="executions"
    )
    triggered_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    seer_run = FlexibleForeignKey(
        "seer.SeerRun",
        null=True,
        on_delete=models.SET_NULL,
        related_name="notebook_block_executions",
    )
    executor = models.CharField(max_length=32, choices=NotebookBlockExecutor.choices)
    status = models.CharField(
        max_length=32,
        choices=NotebookBlockExecutionStatus.choices,
        default=NotebookBlockExecutionStatus.PENDING,
        db_default=NotebookBlockExecutionStatus.PENDING,
    )
    block_version = BoundedPositiveIntegerField()
    # The resolved inputs, so a rerun is reproducible after the notebook changes.
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
    # The projects whose data went into this output. Unlike the notebook's project
    # selection, these don't change after the run.
    data_projects = models.ManyToManyField(
        "sentry.Project", through="notebooks.NotebookBlockExecutionProject", blank=True
    )

    class Meta:
        app_label = "notebooks"
        db_table = "notebooks_notebookblockexecution"
        indexes = [
            models.Index(fields=["block", "-date_added"]),
            models.Index(fields=["block", "status"]),
        ]

    __repr__ = sane_repr("block_id", "executor", "status")


@cell_silo_model
class NotebookBlockExecutionProject(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    execution = FlexibleForeignKey(
        "notebooks.NotebookBlockExecution",
        on_delete=models.CASCADE,
        related_name="data_project_links",
    )
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    class Meta:
        app_label = "notebooks"
        db_table = "notebooks_notebookblockexecutionproject"
        constraints = [
            models.UniqueConstraint(
                fields=["execution", "project"],
                name="notebook_unique_block_execution_project",
            )
        ]
