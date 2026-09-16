from __future__ import annotations

from typing import Any

from django.db import models
from django.db.models import F, Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class InvestigationBlockKind(models.TextChoices):
    TEXT = "text", "Text"
    QUERY = "query", "Query"


@cell_silo_model
class InvestigationBlock(DefaultFieldsModel):
    """A user-composed block whose content may be produced by a Seer execution."""

    __relocation_scope__ = RelocationScope.Excluded

    investigation = FlexibleForeignKey(
        "investigations.Investigation", on_delete=models.CASCADE, related_name="blocks"
    )
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    last_edited_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    position = BoundedPositiveIntegerField()
    kind = models.CharField(max_length=32, choices=InvestigationBlockKind.choices)
    title = models.CharField(max_length=255, default="", blank=True, db_default="")
    # The canonical, editable body rendered or evaluated by this block.
    content = models.TextField(default="", blank=True, db_default="")
    # The latest prompt used to generate content. This remains editable so a
    # future execution can regenerate the block.
    prompt = models.TextField(default="", blank=True, db_default="")
    # The unedited output of the latest generation. Human edits update content
    # without erasing the generated source.
    generated_content = models.TextField(default="", blank=True, db_default="")

    # Kind-specific execution and authoring behavior, such as automatic execution
    # or a dataset hint. Presentation-only state belongs in `display`.
    config: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    # Versioned presentation state, such as table/chart selection or whether a
    # prompt is collapsed. It must not affect how a block executes.
    display: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )

    version = BoundedPositiveIntegerField(default=1, db_default=1)
    current_execution = FlexibleForeignKey(
        "investigations.InvestigationBlockExecution",
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # The successful execution that produced the currently rendered text body.
    # This remains stable while a newer generation is pending or fails so the
    # existing Markdown keeps its original project-access requirements.
    content_execution = FlexibleForeignKey(
        "investigations.InvestigationBlockExecution",
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # The latest successful execution that produced a query result. It remains
    # stable while a replacement run is pending, stopped, or fails.
    result_execution = FlexibleForeignKey(
        "investigations.InvestigationBlockExecution",
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # Set when an input changes so the UI can distinguish a valid old output
    # from a current one before a replacement execution finishes.
    stale_at = models.DateTimeField(null=True)

    # Agent-generated blocks are revision-fenced; manual and template blocks leave these empty.
    # The owning investigation identifies the one-to-one orchestration run.
    report_revision = BoundedPositiveIntegerField(null=True)
    stable_agent_key = models.CharField(max_length=128, null=True)
    # Seer's own run id for the run that authored this block. Not a foreign key:
    # a block can be produced by a per-hypothesis investigator run that Seer
    # spawns itself, which Sentry never initiates and so never mirrors.
    producing_seer_run_id = BoundedBigIntegerField(null=True)

    # Blocks are hidden rather than hard-deleted so execution history remains
    # inspectable and stale references retain a stable target.
    deleted_at = models.DateTimeField(null=True)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationblock"
        indexes = [
            models.Index(fields=["investigation", "deleted_at", "position"]),
            models.Index(fields=["investigation", "-date_updated"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["investigation", "report_revision", "stable_agent_key"],
                condition=Q(stable_agent_key__isnull=False),
                name="invest_unique_report_block_key",
            )
        ]

    __repr__ = sane_repr("investigation_id", "kind", "position")


@cell_silo_model
class InvestigationBlockDependency(DefaultFieldsModel):
    """A directed edge from a block to one of its upstream dependencies."""

    __relocation_scope__ = RelocationScope.Excluded

    block = FlexibleForeignKey(
        "investigations.InvestigationBlock",
        on_delete=models.CASCADE,
        related_name="dependency_links",
    )
    depends_on = FlexibleForeignKey(
        "investigations.InvestigationBlock",
        on_delete=models.CASCADE,
        related_name="dependent_links",
    )

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationblockdependency"
        constraints = [
            models.UniqueConstraint(
                fields=["block", "depends_on"], name="investigation_unique_block_dependency"
            ),
            models.CheckConstraint(
                condition=~Q(block=F("depends_on")), name="investigation_no_self_dependency_block"
            ),
        ]
