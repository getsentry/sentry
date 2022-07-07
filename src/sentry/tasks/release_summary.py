from datetime import timedelta

from django.utils import timezone

from sentry.models import Activity, Deploy, Release, ReleaseCommit
from sentry.notifications.notifications.activity.release_summary import ReleaseRoundupNotification
from sentry.notifications.utils.participants import _get_release_committers
from sentry.tasks.base import instrumented_task
from sentry.types.activity import ActivityType


@instrumented_task(name="sentry.tasks.digest.release_summary")
def prepare_release_summary():
    """
    Summarize new issues in a release an hour after deployment
    """
    now = timezone.now()
    deploys = (
        Deploy.objects.filter(
            date_finished__gte=now - timedelta(hours=1),
            date_finished__lt=now - timedelta(hours=1, minutes=5),
            notified=True,
        )
        .order_by("-date_finished")
        .select_related("release")
        .distinct("release")
    )

    for deploy in deploys:
        release: Release = deploy.release
        release_has_commits = ReleaseCommit.objects.filter(
            organization_id=release.organization_id, release=release
        ).exists()
        if not release_has_commits:
            continue

        # Check if any participants are members of the feature flag
        # TODO(workflow): can remove with active-release-notification-opt-in
        participants = _get_release_committers(release)
        if not participants:
            continue

        # Find the activity created in Deploy.notify_if_ready
        activity = (
            Activity.objects.filter(
                type=ActivityType.DEPLOY.value,
                project=release.projects.first(),
                ident=Activity.get_version_ident(release.version),
            )
            .order_by("-datetime")
            .first()
        )
        if not activity:
            continue

        release_summary = ReleaseRoundupNotification(activity)
        release_summary.send()
