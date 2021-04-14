"""
sentry.models.deploy
~~~~~~~~~~~~~~~~~~~~
"""


from django.db import models
from django.utils import timezone

from sentry.app import locks
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model
from sentry.utils.retries import TimedRetryPolicy


class Deploy(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    release = FlexibleForeignKey("sentry.Release")
    environment_id = BoundedPositiveIntegerField(db_index=True)
    date_finished = models.DateTimeField(default=timezone.now)
    date_started = models.DateTimeField(null=True, blank=True)
    name = models.CharField(max_length=64, null=True, blank=True)
    url = models.URLField(null=True, blank=True)
    notified = models.NullBooleanField(null=True, db_index=True, default=False)

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
        from sentry.models import Activity, Environment, ReleaseCommit, ReleaseHeadCommit

        lock_key = cls.get_lock_key(deploy_id)
        lock = locks.get(lock_key, duration=30)
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
                    type=Activity.DEPLOY,
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
