from datetime import timedelta

from django.utils import timezone

from sentry.models import Deploy, Group, GroupRelease, GroupStatus, Release


def is_resolved_issue_within_active_release(issue_id: int) -> bool:
    # check that the issue is resolved and is part of a release
    if (not Group.objects.filter(id=issue_id, status=GroupStatus.RESOLVED).exists()) or len(
        GroupRelease.objects.filter(id=issue_id).values_list("release_id", flat=True)
    ) == 0:
        return False
    else:
        # check that the issue was resolved in active release

        # returns the release version associated with the issue
        latest_release_version_issue = Group.objects.filter(id=issue_id).first().get_last_release()

        # get release object from version
        latest_release_issue = Release.objects.filter(version=latest_release_version_issue)

        # get latest deploy of the release associated with the issue
        latest_deploy_release: Deploy = (
            Deploy.objects.filter(release_id=latest_release_issue.first().id)
            .order_by("-date_finished")
            .first()
            or Deploy.objects.filter(id=latest_release_issue.first().last_deploy_id).first()
        )

        # get the time of the latest deploy
        if not latest_deploy_release:
            return False

        latest_deploy_release_time = latest_deploy_release.date_finished

        now_minus_1_hour = timezone.now() - timedelta(hours=1.0)

        print("=" * 40)
        print(now_minus_1_hour)
        print(latest_deploy_release_time)
        print(timezone.now())
        print("=" * 40)

        return bool(now_minus_1_hour <= latest_deploy_release_time <= timezone.now())
