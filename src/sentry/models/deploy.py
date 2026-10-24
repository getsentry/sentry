from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    cell_silo_model,
)
from sentry.locks import locks
from sentry.models.environment import Environment
from sentry.types.activity import ActivityType
from sentry.utils.retries import TimedRetryPolicy


@cell_silo_model
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

    class Meta:
        app_label = "sentry"
        db_table = "sentry_deploy"
        indexes = (models.Index(fields=("release", "environment_id", "notified")),)

    @staticmethod
    def get_lock_key(release_id, environment_id):
        # Repeated callbacks for one deployment share a release and environment
        # but not a Deploy id, so the lock has to cover that pair.
        return "deploy-notify:%s:%s" % (release_id, environment_id)

    @classmethod
    def notify_if_ready(cls, deploy_id, fetch_complete=False):
        """
        create activity and send deploy notifications
        if they haven't been sent
        """
        from sentry.models.activity import Activity
        from sentry.models.releasecommit import ReleaseCommit
        from sentry.models.releaseheadcommit import ReleaseHeadCommit

        deploy = cls.objects.get(id=deploy_id)
        lock_key = cls.get_lock_key(deploy.release_id, deploy.environment_id)
        lock = locks.get(lock_key, duration=30, name="deploy_notify")
        with TimedRetryPolicy(10)(lock.acquire):
            # Refresh inside the lock so a concurrent callback can't notify first
            # and then lose the race to this row's stale state.
            deploy = cls.objects.filter(id=deploy_id).select_related("release").get()
            if deploy.notified:
                return

            release = deploy.release
            # Another row for this release and environment already produced the
            # notification. Keep this row for deploy history, and mark it notified
            # so a later commit-fetch retry does not send again.
            if (
                cls.objects.filter(
                    organization_id=deploy.organization_id,
                    release_id=release.id,
                    environment_id=deploy.environment_id,
                    notified=True,
                )
                .exclude(id=deploy.id)
                .exists()
            ):
                deploy.update(notified=True)
                return

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
