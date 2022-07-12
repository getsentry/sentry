from datetime import timedelta

from django.utils import timezone

from sentry.models import Deploy, Group, GroupStatus, Release


def is_resolved_issue_within_active_release(issue_id: int) -> bool:
    # check that the issue is resolved and is part of a release

    issue = Group.objects.filter(id=issue_id).first()

    if issue is None or issue.status != GroupStatus.RESOLVED or issue.get_last_release() is None:
        print("first if statement")
        print(issue)
        if issue is not None:
            print(issue.status)
            print(issue.get_last_release)
        print("if statement done")
        return False

    # returns the release version associated with the issue
    latest_release_version_issue = issue.get_last_release()

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
        print("latest_deploy_release is None")
        return False

    latest_deploy_release_time = latest_deploy_release.date_finished

    now_minus_1_hour = timezone.now() - timedelta(hours=1.0)

    print("=" * 40)
    print(now_minus_1_hour)
    print(latest_deploy_release_time)
    print(timezone.now())
    print("=" * 40)

    return now_minus_1_hour <= latest_deploy_release_time <= timezone.now()
