from __future__ import annotations

from typing import Any

from django.db import models
from django.db.models import Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class NotebookBlockKind(models.TextChoices):
    TEXT = "text", "Text"
    QUERY = "query", "Query"


@cell_silo_model
class NotebookBlock(DefaultFieldsModel):
    """A notebook block whose content may be produced by a Seer execution."""

    __relocation_scope__ = RelocationScope.Excluded

    notebook = FlexibleForeignKey(
        "notebooks.Notebook", on_delete=models.CASCADE, related_name="blocks"
    )
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    last_edited_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    position = BoundedPositiveIntegerField()
    kind = models.CharField(max_length=32, choices=NotebookBlockKind.choices)
    title = models.CharField(max_length=255, default="", blank=True, db_default="")
    content = models.TextField(default="", blank=True, db_default="")
    prompt = models.TextField(default="", blank=True, db_default="")
    # The unedited output of the latest generation. Human edits change content only.
    generated_content = models.TextField(default="", blank=True, db_default="")

    # How the block runs, such as auto-run or a dataset hint.
    config: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    # Presentation only. It must not change how the block runs.
    display: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )

    version = BoundedPositiveIntegerField(default=1, db_default=1)
    current_execution = FlexibleForeignKey(
        "notebooks.NotebookBlockExecution",
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # The successful execution behind the shown text. It stays put while a newer run is
    # pending or fails, so the text keeps the project-access rules it was made under.
    content_execution = FlexibleForeignKey(
        "notebooks.NotebookBlockExecution",
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # The latest successful query result. It stays put while a newer run is pending,
    # stopped or failed.
    result_execution = FlexibleForeignKey(
        "notebooks.NotebookBlockExecution",
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # Set when an input changes, so an old output isn't shown as current.
    stale_at = models.DateTimeField(null=True)

    # A producer's key for the block. Producers that replace their output in
    # revisions also set producer_revision; blocks people add leave both empty.
    producer_key = models.CharField(max_length=128, null=True)
    producer_revision = BoundedPositiveIntegerField(null=True)
    # Not a foreign key: Seer can start runs for a block that Sentry never sees.
    producing_seer_run_id = BoundedBigIntegerField(null=True)

    # Soft delete keeps execution history and comment targets.
    deleted_at = models.DateTimeField(null=True)

    class Meta:
        app_label = "notebooks"
        db_table = "notebooks_notebookblock"
        indexes = [models.Index(fields=["notebook", "deleted_at", "position"])]
        constraints = [
            models.UniqueConstraint(
                fields=["notebook", "producer_revision", "producer_key"],
                condition=Q(producer_key__isnull=False),
                name="notebook_unique_producer_block",
            )
        ]

    __repr__ = sane_repr("notebook_id", "kind", "position")
