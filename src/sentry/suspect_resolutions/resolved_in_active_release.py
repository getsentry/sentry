from datetime import timedelta

from django.utils import timezone

from sentry.models import Deploy, Group, GroupStatus, Project, Release


def is_resolved_issue_within_active_release(issue_id: int, project: Project) -> bool:
    # check that the issue is resolved and is part of a release

    issue = Group.objects.filter(id=issue_id, project=project).first()

    if issue is None or issue.status != GroupStatus.RESOLVED or issue.get_last_release() is None:
        return False

    # returns the release version associated with the issue
    latest_release_version_issue = issue.get_last_release()

    # get release object from version
    latest_release_issue = Release.objects.filter(
        version=latest_release_version_issue, project_id=project.id
    )

    if len(latest_release_issue) != 0:
        return False

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

    now_minus_1_hour = timezone.now() - timedelta(hours=1.0)

    return now_minus_1_hour <= latest_deploy_release.date_finished <= timezone.now()
