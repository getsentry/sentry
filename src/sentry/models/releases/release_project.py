from __future__ import annotations

import logging
from typing import TYPE_CHECKING, ClassVar

from django.db import models
from django.utils import timezone

from sentry import features
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
)
from sentry.db.models.manager import BaseManager
from sentry.incidents.utils.types import AlertRuleActivationConditionType
from sentry.tasks.relay import schedule_invalidate_project_config

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.models.project import Project
    from sentry.models.release import Release
    from sentry.snuba.models import QuerySubscription


class ReleaseProjectModelManager(BaseManager["ReleaseProject"]):
    @staticmethod
    def _on_post(project, trigger):
        from sentry.dynamic_sampling import ProjectBoostedReleases

        project_boosted_releases = ProjectBoostedReleases(project.id)
        # We want to invalidate the project config only if dynamic sampling is enabled and there exists boosted releases
        # in the project.
        if (
            features.has("organizations:dynamic-sampling", project.organization)
            and project_boosted_releases.has_boosted_releases
        ):
            schedule_invalidate_project_config(project_id=project.id, trigger=trigger)

    @staticmethod
    def _subscribe_project_to_alert_rule(
        project: Project, release: Release, trigger: str
    ) -> list[QuerySubscription]:
        """
        TODO: potentially enable custom query_extra to be passed on ReleaseProject creation (on release/deploy)
        NOTE: import AlertRule model here to avoid circular dependency
        TODO: move once AlertRule has been split into separate subdirectory files
        """
        from sentry.incidents.temp_model import AlertRule

        query_extra = f"release:{release.version} AND event.timestamp:>{timezone.now().isoformat()}"
        return AlertRule.objects.conditionally_subscribe_project_to_alert_rules(
            project=project,
            activation_condition=AlertRuleActivationConditionType.RELEASE_CREATION,
            query_extra=query_extra,
            trigger=trigger,
        )

    def post_save(self, instance, created, **kwargs):
        self._on_post(project=instance.project, trigger="releaseproject.post_save")
        if created:
            self._subscribe_project_to_alert_rule(
                project=instance.project,
                release=instance.release,
                trigger="releaseproject.post_save",
            )

    def post_delete(self, instance, **kwargs):
        self._on_post(project=instance.project, trigger="releaseproject.post_delete")


@region_silo_only_model
class ReleaseProject(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    release = FlexibleForeignKey("sentry.Release")
    new_groups = BoundedPositiveIntegerField(null=True, default=0)

    adopted = models.DateTimeField(null=True, blank=True)
    unadopted = models.DateTimeField(null=True, blank=True)
    first_seen_transaction = models.DateTimeField(null=True, blank=True)

    objects: ClassVar[ReleaseProjectModelManager] = ReleaseProjectModelManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_release_project"
        indexes = (
            models.Index(fields=("project", "adopted")),
            models.Index(fields=("project", "unadopted")),
            models.Index(fields=("project", "first_seen_transaction")),
        )
        unique_together = (("project", "release"),)
