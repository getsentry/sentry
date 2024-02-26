from __future__ import annotations

import logging
from typing import ClassVar

from django.db import models

from sentry import features
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
)
from sentry.db.models.manager import BaseManager
from sentry.tasks.relay import schedule_invalidate_project_config

logger = logging.getLogger(__name__)


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

    def _subscribe_project_to_alert_rule(project, release, trigger):
        """
        TODO: potentially enable custom query_extra to be passed on ReleaseProject creation (on release/deploy)
        """
        from django.utils import timezone

        from sentry.incidents.logic import subscribe_projects_to_alert_rule
        from sentry.incidents.models import (
            AlertRule,
            AlertRuleActivationConditionType,
            AlertRuleMonitorType,
        )

        try:
            project_alert_rules = AlertRule.filter(project=project)
            if project_alert_rules.exists():
                # If we have an AlertRule for the project
                for par in project_alert_rules:
                    if (
                        par.monitor_type == AlertRuleMonitorType.ACTIVATED
                        and par.activation_conditions
                        == AlertRuleActivationConditionType.RELEASE_CREATION
                    ):
                        query_extra = (
                            f"release:{release.version} AND event.timestamp:>{timezone.now()}"
                        )
                        logger.info(
                            "Attempt subscribe project to activated alert rule",
                            extra={
                                "trigger": trigger,
                                "query_extra": query_extra,
                            },
                        )
                        subscribe_projects_to_alert_rule(
                            alert_rule=par, projects=[project], query_extra=query_extra
                        )
        except Exception as e:
            logger.exception(
                "Failed to subscribe project to activated alert rule",
                extra={
                    "trigger": trigger,
                    "exception": e,
                },
            )

    def post_save(self, instance, **kwargs):
        self._on_post(project=instance.project, trigger="releaseproject.post_save")
        self._subscribe_project_to_alert_rule(
            project=instance.project, release=instance.release, trigger="releaseproject.post_save"
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
