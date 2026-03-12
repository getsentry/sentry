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

    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    repository = FlexibleForeignKey("sentry.Repository", on_delete=models.CASCADE)
    branch_name = models.TextField(null=True, blank=True)
    instructions = models.TextField(null=True, blank=True)
    branch_overrides = models.JSONField(default=list, blank=True)

    class Meta:
        app_label = "seer"
        db_table = "seer_projectrepository"
        unique_together = (("project", "repository"),)

    __repr__ = sane_repr("project_id", "repository_id")
