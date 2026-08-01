from __future__ import annotations

from typing import Any
from uuid import uuid4

from django.db import models
from django.db.models import Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel, Model
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

from .relocation import RegenerateInvestigationUUIDsOnRelocationMixin


class InvestigationStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"


class InvestigationSourceType(models.TextChoices):
    MANUAL = "manual", "Manual"
    BREACHED_METRIC = "breached_metric", "Breached metric"
    SUPERGROUP = "supergroup", "Supergroup"


@cell_silo_model
class InvestigationProject(Model):
    """A saved project filter. It does not grant access to project data."""

    __relocation_scope__ = RelocationScope.Organization

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

    __relocation_scope__ = RelocationScope.Organization

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
class Investigation(RegenerateInvestigationUUIDsOnRelocationMixin, DefaultFieldsModel):
    """An organization-visible, manually composed investigation notebook."""

    __relocation_scope__ = RelocationScope.Organization

    uuid = models.UUIDField(default=uuid4, editable=False, unique=True)
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

    # Saved defaults, equivalent to a dashboard's filters. Access is still checked
    # against the viewer when a cell is evaluated or an output is returned.
    filters: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    projects = models.ManyToManyField("sentry.Project", through=InvestigationProject, blank=True)

    # Incremented by write services to support optimistic concurrency in the editor.
    version = BoundedPositiveIntegerField(default=1, db_default=1)

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
            )
        ]
        indexes = [
            models.Index(fields=["organization", "status", "-date_updated"]),
            models.Index(fields=["organization", "-date_added"]),
        ]

    __repr__ = sane_repr("organization_id", "uuid", "title")
