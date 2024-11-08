from __future__ import annotations

from datetime import timedelta
from enum import Enum
from typing import TYPE_CHECKING, ClassVar

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base import BaseManager
from sentry.incidents.utils.types import AlertRuleActivationConditionType
from sentry.utils import metrics
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.environment import Environment
    from sentry.models.project import Project
    from sentry.models.release import Release
    from sentry.snuba.models import QuerySubscription


class ReleaseStages(str, Enum):
    ADOPTED = "adopted"
    LOW_ADOPTION = "low_adoption"
    REPLACED = "replaced"


class ReleaseProjectEnvironmentManager(BaseManager["ReleaseProjectEnvironment"]):
    @staticmethod
    def subscribe_project_to_alert_rule(
        project: Project, release: Release, environment: Environment, trigger: str
    ) -> list[QuerySubscription]:
        """
        TODO: potentially enable custom query_extra to be passed on ReleaseProject creation (on release/deploy)

        NOTE: import AlertRule model here to avoid circular dependency
        """
        from sentry.incidents.models.alert_rule import AlertRule

        query_extra = f"release:{release.version} and environment:{environment.name}"
        # TODO: parse activator on the client to derive release version / environment name
        activator = f"release:{release.version} and environment:{environment.name}"
        return AlertRule.objects.conditionally_subscribe_project_to_alert_rules(
            project=project,
            activation_condition=AlertRuleActivationConditionType.DEPLOY_CREATION,
            query_extra=query_extra,
            origin=trigger,
            activator=activator,
        )

    def post_save(
        self, *, instance: ReleaseProjectEnvironment, created: bool, **kwargs: object
    ) -> None:
        if created:
            release = instance.release
            project = instance.project
            environment = instance.environment
            self.subscribe_project_to_alert_rule(
                project=project,
                release=release,
                environment=environment,
                trigger="releaseprojectenvironment.post_save",
            )


@region_silo_model
class ReleaseProjectEnvironment(Model):
    __relocation_scope__ = RelocationScope.Excluded

    release = FlexibleForeignKey("sentry.Release")
    project = FlexibleForeignKey("sentry.Project")
    environment = FlexibleForeignKey("sentry.Environment")
    new_issues_count = BoundedPositiveIntegerField(default=0)
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    last_deploy_id = BoundedPositiveIntegerField(null=True, db_index=True)

    adopted = models.DateTimeField(null=True, blank=True)
    unadopted = models.DateTimeField(null=True, blank=True)

    objects: ClassVar[ReleaseProjectEnvironmentManager] = ReleaseProjectEnvironmentManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releaseprojectenvironment"
        indexes = (
            models.Index(fields=("project", "adopted", "environment")),
            models.Index(fields=("project", "unadopted", "environment")),
        )
        unique_together = (("project", "release", "environment"),)

    __repr__ = sane_repr("project", "release", "environment")

    @classmethod
    def get_cache_key(cls, release_id, project_id, environment_id):
        return f"releaseprojectenv:{release_id}:{project_id}:{environment_id}"

    @classmethod
    def get_or_create(cls, release, project, environment, datetime, **kwargs):
        with metrics.timer("models.releaseprojectenvironment.get_or_create") as metrics_tags:
            return cls._get_or_create_impl(
                release, project, environment, datetime, metrics_tags, **kwargs
            )

    @classmethod
    def _get_or_create_impl(cls, release, project, environment, datetime, metrics_tags, **kwargs):
        cache_key = cls.get_cache_key(project.id, release.id, environment.id)

        instance = cache.get(cache_key)
        if instance is None:
            metrics_tags["cache_hit"] = "false"
            instance, created = cls.objects.get_or_create(
                release=release,
                project=project,
                environment=environment,
                defaults={"first_seen": datetime, "last_seen": datetime},
            )
            cache.set(cache_key, instance, 3600)
        else:
            metrics_tags["cache_hit"] = "true"
            created = False

        metrics_tags["created"] = "true" if created else "false"

        # Same as releaseenvironment model. Minimizes last_seen updates to once a minute
        if not created and instance.last_seen < datetime - timedelta(seconds=60):
            cls.objects.filter(
                id=instance.id, last_seen__lt=datetime - timedelta(seconds=60)
            ).update(last_seen=datetime)
            instance.last_seen = datetime
            cache.set(cache_key, instance, 3600)
            metrics_tags["bumped"] = "true"
        else:
            metrics_tags["bumped"] = "false"

        return instance

    @property
    def adoption_stages(self):
        if self.adopted is not None and self.unadopted is None:
            stage = ReleaseStages.ADOPTED
        elif self.adopted is not None and self.unadopted is not None:
            stage = ReleaseStages.REPLACED
        else:
            stage = ReleaseStages.LOW_ADOPTION

        return {"stage": stage, "adopted": self.adopted, "unadopted": self.unadopted}
