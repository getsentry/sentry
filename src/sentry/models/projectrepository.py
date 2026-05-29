from __future__ import annotations

from typing import ClassVar

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.manager.base import BaseManager


class ProjectRepositorySource(models.IntegerChoices):
    MANUAL = 0, "manual"
    SCM_ONBOARDING = 1, "scm_onboarding"
    AUTO_EVENT = 2, "auto_event"
    AUTO_NAME_MATCH = 3, "auto_name_match"
    SEER_PREFERENCE = 4, "seer_preference"


class ProjectRepositoryManager(BaseManager["ProjectRepository"]):
    def get_or_create_with_source(
        self,
        project_id: int,
        repository_id: int,
        source: int,
    ) -> tuple[ProjectRepository, bool]:
        """
        Like get_or_create, but upgrades the source if the existing row
        was created by a lower-confidence mechanism (AUTO_NAME_MATCH).
        """
        project_repo, created = self.get_or_create(
            project_id=project_id,
            repository_id=repository_id,
            defaults={"source": source},
        )
        if (
            not created
            and project_repo.source == ProjectRepositorySource.AUTO_NAME_MATCH
            and source != ProjectRepositorySource.AUTO_NAME_MATCH
        ):
            project_repo.source = source
            project_repo.save(update_fields=["source"])
        return project_repo, created


@cell_silo_model
class ProjectRepository(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Global

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    repository = FlexibleForeignKey("sentry.Repository", on_delete=models.CASCADE)
    source = models.SmallIntegerField(
        choices=ProjectRepositorySource.choices,
        default=ProjectRepositorySource.MANUAL,
    )

    objects: ClassVar[ProjectRepositoryManager] = ProjectRepositoryManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectrepository"
        unique_together = (("project", "repository"),)

    __repr__ = sane_repr("project_id", "repository_id")
