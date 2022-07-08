from datetime import timedelta, timezone

from sentry.models import Deploy, Group, GroupStatus, Release

# given an issue_id, we want to check that the issue was resolved in a recent release
# what is the relationship between an event and an issue - multiple events are grouped into one issue
# time between release and resolution should be within an hour
# entry point
# check that the issue is resolved - are we checking when the issue itself came up or when the issue was resolved


def is_resolved_issue_within_active_release(issue_id: int) -> bool:
    # was this resolved issue a result of a recent deployment?

    # check that the issue is resolved
    if not Group.objects.filter(id=issue_id, status=GroupStatus.RESOLVED).exists():
        return False
    else:
        # check that the issue was resolved in active release

        # returns the release version associated with the issue
        latest_release_version_issue = Group.objects.filter(id=1)[0].get_last_release()

        # get release object from version
        latest_release_issue = Release.objects.filter(version=latest_release_version_issue)

        # get latest deploy of the release associated with the issue
        latest_deploy_release: Deploy = (
            Deploy.objects.filter(release_id=latest_release_issue.id)
            .order_by("-date_finished")
            .first()
            or Deploy.objects.filter(id=latest_release_issue.last_deploy_id).first()
        )

        # get the time of the latest deploy
        latest_deploy_release_time = latest_deploy_release.date_finished

        now_minus_1_hour = timezone.now() - timedelta(hours=1.0)

        return bool(now_minus_1_hour <= latest_deploy_release_time <= timezone.now())


def is_resolved_issue_within_existing_release(issue_id: int) -> bool:
    # was this resolved issue a result of an existing release?

    # check if issue has been resolved

    # check if issue was resolved in existing release

    return True
