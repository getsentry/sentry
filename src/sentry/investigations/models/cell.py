from __future__ import annotations

from typing import Any
from uuid import uuid4

from django.db import models
from django.db.models import F, Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel, Model
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

from .relocation import RegenerateInvestigationUUIDsOnRelocationMixin


class InvestigationCellKind(models.TextChoices):
    TEXT = "text", "Text"
    QUERY = "query", "Query"


@cell_silo_model
class InvestigationCell(RegenerateInvestigationUUIDsOnRelocationMixin, DefaultFieldsModel):
    """A user-composed cell whose content may be produced by a Seer execution."""

    __relocation_scope__ = RelocationScope.Organization
    __relocation_ignored_foreign_keys__ = {"current_execution"}

    uuid = models.UUIDField(default=uuid4, editable=False, unique=True)
    investigation = FlexibleForeignKey(
        "investigations.Investigation", on_delete=models.CASCADE, related_name="cells"
    )
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    last_edited_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    position = BoundedPositiveIntegerField()
    kind = models.CharField(max_length=32, choices=InvestigationCellKind.choices)
    title = models.CharField(max_length=255, default="", blank=True, db_default="")
    # The canonical, editable body rendered or evaluated by this cell.
    content = models.TextField(default="", blank=True, db_default="")
    # The latest prompt used to generate content. This remains editable so a
    # future execution can regenerate the cell.
    prompt = models.TextField(default="", blank=True, db_default="")
    # The unedited output of the latest generation. Human edits update content
    # without erasing the generated source for provenance.
    generated_content = models.TextField(default="", blank=True, db_default="")

    # Kind-specific authoring and rendering settings. Query cells can, for
    # example, choose table or chart display without changing their result.
    config: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    display: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )

    version = BoundedPositiveIntegerField(default=1, db_default=1)
    current_execution = FlexibleForeignKey(
        "investigations.InvestigationCellExecution",
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # Set when an input changes so the UI can distinguish a valid old output
    # from a current one before a replacement execution finishes.
    stale_at = models.DateTimeField(null=True)

    # Cells are hidden rather than hard-deleted so later comment threads and
    # reactions can retain a stable target and audit history.
    deleted_at = models.DateTimeField(null=True)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationcell"
        indexes = [
            models.Index(fields=["investigation", "deleted_at", "position"]),
            models.Index(fields=["investigation", "-date_updated"]),
        ]

    __repr__ = sane_repr("investigation_id", "uuid", "kind", "position")

    def normalize_before_relocation_import(self, pk_map: Any, scope: Any, flags: Any) -> int | None:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is not None:
            # Executions are imported after their cells. The current pointer therefore cannot
            # be remapped in the import's first pass; clearing it is safer than retaining a
            # dangling source-database primary key. Execution history is still relocated.
            self.current_execution_id = None
        return old_pk


@cell_silo_model
class InvestigationCellDependency(Model):
    """A directed edge from a cell to one of its upstream dependencies."""

    __relocation_scope__ = RelocationScope.Organization

    cell = FlexibleForeignKey(
        "investigations.InvestigationCell",
        on_delete=models.CASCADE,
        related_name="dependency_links",
    )
    depends_on = FlexibleForeignKey(
        "investigations.InvestigationCell",
        on_delete=models.CASCADE,
        related_name="dependent_links",
    )

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationcelldependency"
        constraints = [
            models.UniqueConstraint(
                fields=["cell", "depends_on"], name="investigation_unique_cell_dependency"
            ),
            models.CheckConstraint(
                condition=~Q(cell=F("depends_on")), name="investigation_no_self_dependency"
            ),
        ]
