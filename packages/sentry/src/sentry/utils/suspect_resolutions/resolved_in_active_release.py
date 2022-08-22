from datetime import timedelta

from django.utils import timezone

from sentry.models import Deploy, Group, GroupStatus, Release


def is_resolved_issue_within_active_release(issue: Group) -> bool:
    if issue is None or issue.status != GroupStatus.RESOLVED or issue.get_last_release() is None:
        return False

    latest_release_version_issue = issue.get_last_release()

    latest_release_issue = Release.objects.filter(
        version=latest_release_version_issue, organization_id=issue.project.organization.id
    )

    if len(latest_release_issue) == 0:
        return False

    latest_deploy_release: Deploy = (
        Deploy.objects.filter(release_id=latest_release_issue.first().id)
        .order_by("-date_finished")
        .first()
        or Deploy.objects.filter(id=latest_release_issue.first().last_deploy_id).first()
    )

    if not latest_deploy_release:
        return False

    now_minus_1_hour = timezone.now() - timedelta(hours=1.0)

    return bool(now_minus_1_hour <= latest_deploy_release.date_finished <= timezone.now())
