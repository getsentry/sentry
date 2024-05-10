from typing import TYPE_CHECKING, ClassVar

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
)
from sentry.db.models.manager import BaseManager
from sentry.incidents.utils.types import AlertRuleActivationConditionType
from sentry.locks import locks
from sentry.models.environment import Environment
from sentry.types.activity import ActivityType
from sentry.utils.retries import TimedRetryPolicy

if TYPE_CHECKING:
    from sentry.models.project import Project
    from sentry.models.release import Release
    from sentry.snuba.models import QuerySubscription


class DeployModelManager(BaseManager["Deploy"]):
    @staticmethod
    def subscribe_project_to_alert_rule(
        project: Project, release: Release, env_id: int, activator: str, trigger: str
    ) -> list[QuerySubscription]:
        """
        TODO: potentially enable custom query_extra to be passed on ReleaseProject creation (on release/deploy)

        NOTE: import AlertRule model here to avoid circular dependency
        """
        from sentry.incidents.models.alert_rule import AlertRule

        query_extra = f"release:{release.version} and env_id:{env_id}"
        return AlertRule.objects.conditionally_subscribe_project_to_alert_rules(
            project=project,
            activation_condition=AlertRuleActivationConditionType.DEPLOY_CREATION,
            query_extra=query_extra,
            origin=trigger,
            activator=activator,
        )

    def post_save(self, instance, created, **kwargs):
        if created:
            release = instance.release
            projects = release.projects.all()
            env_id = instance.environment_id
            for project in projects:
                self.subscribe_project_to_alert_rule(
                    project=project,
                    release=release,
                    env_id=env_id,
                    trigger="deploy.post_save",
                )


@region_silo_model
class Deploy(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    release = FlexibleForeignKey("sentry.Release")
    environment_id = BoundedPositiveIntegerField(db_index=True)
    date_finished = models.DateTimeField(default=timezone.now, db_index=True)
    date_started = models.DateTimeField(null=True, blank=True)
    name = models.CharField(max_length=64, null=True, blank=True)
    url = models.URLField(null=True, blank=True)
    notified = models.BooleanField(null=True, db_index=True, default=False)

    objects: ClassVar[DeployModelManager] = DeployModelManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_deploy"

    @staticmethod
    def get_lock_key(deploy_id):
        return "deploy-notify:%s" % deploy_id

    @classmethod
    def notify_if_ready(cls, deploy_id, fetch_complete=False):
        """
        create activity and send deploy notifications
        if they haven't been sent
        """
        from sentry.models.activity import Activity
        from sentry.models.releasecommit import ReleaseCommit
        from sentry.models.releaseheadcommit import ReleaseHeadCommit

        lock_key = cls.get_lock_key(deploy_id)
        lock = locks.get(lock_key, duration=30, name="deploy_notify")
        with TimedRetryPolicy(10)(lock.acquire):
            deploy = cls.objects.filter(id=deploy_id).select_related("release").get()
            if deploy.notified:
                return

            release = deploy.release
            environment = Environment.objects.get(
                organization_id=deploy.organization_id, id=deploy.environment_id
            )

            if not fetch_complete:
                release_has_commits = ReleaseCommit.objects.filter(
                    organization_id=release.organization_id, release=release
                ).exists()

                if not release_has_commits:
                    # check if we have head commits, which
                    # would indicate that we're waiting for
                    # fetch_commits to complete
                    if ReleaseHeadCommit.objects.filter(
                        organization_id=release.organization_id, release=release
                    ).exists():
                        return

            activity = None
            for project in deploy.release.projects.all():
                activity = Activity.objects.create(
                    type=ActivityType.DEPLOY.value,
                    project=project,
                    ident=Activity.get_version_ident(release.version),
                    data={
                        "version": release.version,
                        "deploy_id": deploy.id,
                        "environment": environment.name,
                    },
                    datetime=deploy.date_finished,
                )
            # Somewhat hacky, only send notification for one
            # Deploy Activity record because it will cover all projects
            if activity is not None:
                activity.send_notification()
                deploy.update(notified=True)
