from __future__ import annotations

from typing import Any

from django.db import models
from django.db.models import Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.viewer_context import ActorId, actor_id_from_references


class NotebookStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"


class NotebookSourceType(models.TextChoices):
    MANUAL = "manual", "Manual"
    METRIC_OPEN_PERIOD = "metric_open_period", "Metric open period"


@cell_silo_model
class NotebookProject(DefaultFieldsModel):
    """A mutable project selection. It does not grant access to project data."""

    __relocation_scope__ = RelocationScope.Excluded

    notebook = FlexibleForeignKey(
        "notebooks.Notebook", on_delete=models.CASCADE, related_name="project_links"
    )
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    class Meta:
        app_label = "notebooks"
        db_table = "notebooks_notebookproject"
        constraints = [
            models.UniqueConstraint(fields=["notebook", "project"], name="notebook_unique_project")
        ]


@cell_silo_model
class NotebookFavoriteUser(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    notebook = FlexibleForeignKey(
        "notebooks.Notebook", on_delete=models.CASCADE, related_name="favorite_users"
    )
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")

    class Meta:
        app_label = "notebooks"
        db_table = "notebooks_notebookfavoriteuser"
        constraints = [
            models.UniqueConstraint(
                fields=["notebook", "user_id"], name="notebook_unique_favorite_user"
            )
        ]


@cell_silo_model
class Notebook(DefaultFieldsModel):
    """An organization-visible notebook, written by people or by a Seer producer."""

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    created_by_service_account_id = HybridCloudForeignKey(
        "service_accounts.ServiceAccount", null=True, on_delete="SET_NULL"
    )

    title = models.CharField(max_length=255)
    status = models.CharField(
        max_length=32,
        choices=NotebookStatus.choices,
        default=NotebookStatus.ACTIVE,
        db_default=NotebookStatus.ACTIVE,
    )

    source_type = models.CharField(
        max_length=32,
        choices=NotebookSourceType.choices,
        default=NotebookSourceType.MANUAL,
        db_default=NotebookSourceType.MANUAL,
    )
    # A server-resolved description of what the notebook is about. Manual notebooks leave it empty.
    source: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    # The producer's identity for what the notebook covers. A later run for the same
    # source reuses the active notebook, or starts a new revision once it's archived.
    source_key = models.CharField(max_length=256, null=True)
    source_revision = BoundedPositiveIntegerField(null=True)

    # Saved defaults, like a dashboard's filters. Access is still checked against the
    # viewer when a block runs or an output is returned.
    filters: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    projects = models.ManyToManyField("sentry.Project", through=NotebookProject, blank=True)

    version = BoundedPositiveIntegerField(default=1, db_default=1)
    title_seer_run = FlexibleForeignKey(
        "seer.SeerRun", null=True, on_delete=models.SET_NULL, related_name="+"
    )
    title_generation_status = models.CharField(max_length=32, null=True)
    summary = models.CharField(max_length=255, null=True)
    summary_description = models.TextField(null=True)

    class Meta:
        app_label = "notebooks"
        db_table = "notebooks_notebook"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(created_by_id__isnull=True) | Q(created_by_service_account_id__isnull=True)
                ),
                name="notebook_creator_reference_shape",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        source_type=NotebookSourceType.MANUAL,
                        source_key__isnull=True,
                        source_revision__isnull=True,
                    )
                    | (
                        ~Q(source_type=NotebookSourceType.MANUAL)
                        & Q(source_key__isnull=False, source_revision__isnull=False)
                    )
                ),
                name="notebook_source_fields_complete",
            ),
            models.UniqueConstraint(
                fields=["organization", "source_key", "source_revision"],
                condition=Q(source_key__isnull=False),
                name="notebook_unique_source_revision",
            ),
            # Concurrent launches for the same source race on this.
            models.UniqueConstraint(
                fields=["organization", "source_key"],
                condition=Q(source_key__isnull=False, status=NotebookStatus.ACTIVE),
                name="notebook_unique_active_source",
            ),
        ]
        indexes = [models.Index(fields=["organization", "status", "-date_updated"])]

    __repr__ = sane_repr("organization_id", "title")

    @property
    def creator_actor(self) -> ActorId | None:
        return actor_id_from_references(
            user_id=self.created_by_id, service_account_id=self.created_by_service_account_id
        )

    def get_absolute_url(self) -> str:
        organization = self.organization
        return organization.absolute_url(
            f"/organizations/{organization.slug}/seer/investigations/{self.id}/"
        )
