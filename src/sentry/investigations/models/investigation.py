from __future__ import annotations

from typing import Any

from django.db import models
from django.db.models import Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class InvestigationStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"


class InvestigationSourceType(models.TextChoices):
    MANUAL = "manual", "Manual"
    BREACHED_METRIC = "breached_metric", "Breached metric"
    ISSUE = "issue", "Issue"


@cell_silo_model
class InvestigationProject(DefaultFieldsModel):
    """A mutable project selection. It does not grant access to project data."""

    __relocation_scope__ = RelocationScope.Excluded

    investigation = FlexibleForeignKey(
        "investigations.Investigation", on_delete=models.CASCADE, related_name="project_links"
    )
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationproject"
        constraints = [
            models.UniqueConstraint(
                fields=["investigation", "project"],
                name="investigation_unique_project",
            )
        ]


@cell_silo_model
class InvestigationFavoriteUser(DefaultFieldsModel):
    """A per-user starred investigation."""

    __relocation_scope__ = RelocationScope.Excluded

    investigation = FlexibleForeignKey(
        "investigations.Investigation",
        on_delete=models.CASCADE,
        related_name="favorite_users",
    )
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationfavoriteuser"
        constraints = [
            models.UniqueConstraint(
                fields=["investigation", "user_id"],
                name="investigation_unique_favorite_user",
            )
        ]


@cell_silo_model
class Investigation(DefaultFieldsModel):
    """An organization-visible, manually composed investigation notebook."""

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    title = models.CharField(max_length=255)
    status = models.CharField(
        max_length=32,
        choices=InvestigationStatus.choices,
        default=InvestigationStatus.ACTIVE,
        db_default=InvestigationStatus.ACTIVE,
    )

    # Templates are code-owned in v0. These fields identify the exact version used
    # to instantiate this durable notebook.
    template_key = models.CharField(max_length=128, null=True)
    template_version = BoundedPositiveIntegerField(null=True)

    source_type = models.CharField(
        max_length=32,
        choices=InvestigationSourceType.choices,
        default=InvestigationSourceType.MANUAL,
        db_default=InvestigationSourceType.MANUAL,
    )
    # Stable source identifiers and safe launch metadata only; never raw query rows.
    source_ref: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    # Canonical identity for a source lineage. Manual investigations leave this empty.
    source_key = models.CharField(max_length=64, null=True)
    # Monotonically increasing within a source lineage. This is independent from
    # `version`, which is used for optimistic concurrency while editing one row.
    source_revision = BoundedPositiveIntegerField(null=True)

    # Saved defaults, equivalent to a dashboard's filters. Access is still checked
    # against the viewer when a cell is evaluated or an output is returned.
    filters: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    projects = models.ManyToManyField("sentry.Project", through=InvestigationProject, blank=True)

    # Incremented by write services to support optimistic concurrency in the editor.
    version = BoundedPositiveIntegerField(default=1, db_default=1)
    title_seer_run = FlexibleForeignKey(
        "seer.SeerRun", null=True, on_delete=models.SET_NULL, related_name="+"
    )
    title_generation_status = models.CharField(max_length=32, null=True)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigation"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(template_key__isnull=True, template_version__isnull=True)
                    | Q(template_key__isnull=False, template_version__isnull=False)
                ),
                name="investigation_template_complete",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        source_type=InvestigationSourceType.MANUAL,
                        source_key__isnull=True,
                        source_revision__isnull=True,
                    )
                    | (
                        ~Q(source_type=InvestigationSourceType.MANUAL)
                        & Q(source_key__isnull=False, source_revision__isnull=False)
                    )
                ),
                name="investigation_source_fields_complete",
            ),
            models.UniqueConstraint(
                fields=["organization", "source_type", "source_key", "source_revision"],
                condition=Q(source_key__isnull=False),
                name="investigation_unique_source_revision",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status", "-date_updated"]),
            models.Index(fields=["organization", "-date_added"]),
            models.Index(
                fields=["organization", "source_type", "source_key", "-source_revision"],
                condition=Q(status=InvestigationStatus.ACTIVE, source_key__isnull=False),
                name="invest_source_latest_idx",
            ),
        ]

    __repr__ = sane_repr("organization_id", "title")
