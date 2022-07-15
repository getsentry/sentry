from datetime import timedelta

from django.utils import timezone

from sentry import features
from sentry.models import Activity, Release, ReleaseActivity, ReleaseCommit
from sentry.notifications.notifications.activity.release_summary import (
    ReleaseSummaryActivityNotification,
)
from sentry.notifications.utils.participants import _get_release_committers
from sentry.tasks.base import instrumented_task
from sentry.types.activity import ActivityType
from sentry.types.releaseactivity import ReleaseActivityType


@instrumented_task(name="sentry.tasks.digest.release_summary")
def prepare_release_summary():
    """
    Summarize new issues in a release an hour after deployment
    """
    now = timezone.now()
    start = now - timedelta(hours=1, minutes=5)
    end = now - timedelta(hours=1)
    releases = Release.objects.filter(
        deploy__date_finished__gte=start,
        deploy__date_finished__lt=end,
        deploy__notified=True,
    )

    for release in releases:
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
                datetime__gte=start,
                datetime__lt=end,
            )
            .order_by("-datetime")
            .first()
        )
        if not activity:
            continue

        release_summary = ReleaseSummaryActivityNotification(activity)
        release_summary.send()
        if features.has("organizations:active-release-monitor-alpha", release.organization):
            ReleaseActivity.objects.create(
                type=ReleaseActivityType.FINISHED.value,
                release=release,
                date_added=now,
            )
