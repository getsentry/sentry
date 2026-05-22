from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


class ProjectRepositorySource(models.IntegerChoices):
    MANUAL = 0, "manual"
    SCM_ONBOARDING = 1, "scm_onboarding"
    AUTO_EVENT = 2, "auto_event"
    AUTO_NAME_MATCH = 3, "auto_name_match"
    SEER_PREFERENCE = 4, "seer_preference"


@cell_silo_model
class ProjectRepository(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Global

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    repository = FlexibleForeignKey("sentry.Repository", on_delete=models.CASCADE)
    source = models.SmallIntegerField(
        choices=ProjectRepositorySource.choices,
        default=ProjectRepositorySource.MANUAL,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectrepository"
        unique_together = (("project", "repository"),)

    __repr__ = sane_repr("project_id", "repository_id")
