from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


@cell_silo_model
class SeerProjectRepository(DefaultFieldsModel):
    """
    Links a Sentry project to a repository with per-repo Seer configuration.
    Used by Seer features (autofix, explorer) to know which repositories are
    relevant for a project and any per-repo overrides (branch, instructions).
    """

    __relocation_scope__ = RelocationScope.Global

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    repository = FlexibleForeignKey("sentry.Repository", on_delete=models.CASCADE)
    branch_name = models.TextField(null=True, blank=True)
    instructions = models.TextField(null=True, blank=True)

    class Meta:
        app_label = "seer"
        db_table = "seer_projectrepository"
        unique_together = (("project", "repository"),)

    __repr__ = sane_repr("project_id", "repository_id")


@cell_silo_model
class SeerProjectRepositoryBranchOverride(DefaultFieldsModel):
    """
    A conditional branch override for a project-repository link.
    When an issue event has a tag matching tag_name/tag_value,
    autofix uses the corresponding branch_name instead of the default.
    """

    __relocation_scope__ = RelocationScope.Global

    seer_project_repository = FlexibleForeignKey(
        "seer.SeerProjectRepository",
        on_delete=models.CASCADE,
        related_name="branch_overrides",
    )
    tag_name = models.TextField()
    tag_value = models.TextField()
    branch_name = models.TextField()

    class Meta:
        app_label = "seer"
        db_table = "seer_projectrepositorybranchoverride"
        unique_together = (("seer_project_repository", "tag_name", "tag_value"),)

    __repr__ = sane_repr("seer_project_repository_id", "tag_name", "tag_value")
