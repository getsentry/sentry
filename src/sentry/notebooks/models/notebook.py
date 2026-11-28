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
    # A detector trigger. The source carries a manual prompt; the key is the occurrence's UUID.
    DETECTOR = "detector", "Detector"


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


class WorkflowEvidenceScope(models.TextChoices):
    NONE = "none"
    PROJECTS = "projects"
    ORGANIZATION = "organization"


@cell_silo_model
class NotebookEvidenceProject(DefaultFieldsModel):
    """A project whose evidence was published in this notebook."""

    __relocation_scope__ = RelocationScope.Excluded

    notebook = FlexibleForeignKey(
        "notebooks.Notebook", on_delete=models.CASCADE, related_name="evidence_project_links"
    )
    # Retain the link when a project disappears: its evidence is still in the notebook.
    project = FlexibleForeignKey("sentry.Project", null=True, on_delete=models.SET_NULL)

    class Meta:
        app_label = "notebooks"
        constraints = [
            models.UniqueConstraint(
                fields=["notebook", "project"], name="notebook_unique_evidence_project"
            )
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
    created_by_org_auth_token_id = HybridCloudForeignKey(
        "sentry.OrgAuthToken", null=True, on_delete="SET_NULL"
    )

    title = models.CharField(max_length=255)
    # The Sentry launch attempt, until Seer commits the workflow and its notebook binding.
    workflow_launch: models.Field[dict[str, Any] | None, dict[str, Any] | None] = models.JSONField(
        null=True
    )
    workflow_evidence_scope = models.CharField(
        max_length=16,
        choices=WorkflowEvidenceScope.choices,
        default=WorkflowEvidenceScope.NONE,
        db_default=WorkflowEvidenceScope.NONE,
    )
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
            # At most one creator column is set.
            models.CheckConstraint(
                condition=(
                    Q(created_by_service_account_id__isnull=True)
                    & Q(created_by_org_auth_token_id__isnull=True)
                )
                | (Q(created_by_id__isnull=True) & Q(created_by_org_auth_token_id__isnull=True))
                | (Q(created_by_id__isnull=True) & Q(created_by_service_account_id__isnull=True)),
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

    def workflow_evidence_project_ids(self) -> list[int] | None:
        """None means no workflow evidence; an empty list requires access to all projects."""
        if self.workflow_evidence_scope == WorkflowEvidenceScope.NONE:
            return None
        if self.workflow_evidence_scope == WorkflowEvidenceScope.ORGANIZATION:
            return []
        ids: list[int | None] = list(
            self.evidence_project_links.values_list("project_id", flat=True)
        )
        projects = []
        for project_id in ids:
            if project_id is None:
                return []
            projects.append(project_id)
        return projects

    def get_absolute_url(self) -> str:
        organization = self.organization
        return organization.absolute_url(
            f"/organizations/{organization.slug}/seer/investigations/{self.id}/"
        )


@cell_silo_model
class NotebookWorkflowRun(DefaultFieldsModel):
    """One durable notebook destination per workflow execution within an organization."""

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    run_id = models.UUIDField()
    notebook = FlexibleForeignKey(Notebook, on_delete=models.CASCADE)
    writer_run = FlexibleForeignKey("seer.SeerRun", null=True, on_delete=models.SET_NULL)
    preserve_title = models.BooleanField(default=False, db_default=False)
    # Each finalizer acknowledges the same snapshot independently.
    delivered: models.Field[dict[str, str], dict[str, str]] = models.JSONField(
        default=dict, db_default={}
    )

    class Meta:
        app_label = "notebooks"
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "run_id"), name="notebook_unique_workflow_run"
            )
        ]
