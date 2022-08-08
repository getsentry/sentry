from typing import Sequence

from sentry import features
from sentry.models import Activity, Group, GroupStatus
from sentry.signals import issue_resolved
from sentry.tasks.base import instrumented_task
from sentry.utils.suspect_resolutions import analytics
from sentry.utils.suspect_resolutions.commit_correlation import is_issue_commit_correlated
from sentry.utils.suspect_resolutions.metric_correlation import is_issue_error_rate_correlated


@issue_resolved.connect(weak=False)
def record_suspect_resolutions(organization_id, project, group, user, resolution_type, **kwargs):
    if features.has("organizations:suspect-resolutions", project.organization):
        get_suspect_resolutions.delay(group.id)


@instrumented_task(name="sentry.tasks.get_suspect_resolutions", queue="get_suspect_resolutions")
def get_suspect_resolutions(resolved_issue_id: int) -> Sequence[Group]:
    resolved_issue = Group.objects.get(id=resolved_issue_id).first()
    resolution_type = Activity.objects.filter(group=resolved_issue).values_list("type").first()

    if resolved_issue.status != GroupStatus.RESOLVED or resolution_type is None:
        return []

    all_project_issues = list(
        Group.objects.filter(status=GroupStatus.UNRESOLVED, project=resolved_issue.project).exclude(
            id=resolved_issue.id
        )
    )

    correlated_issues = []

    for issue in all_project_issues:
        (
            is_rate_correlated,
            coefficient,
            resolution_time,
            start_time,
            end_time,
        ) = is_issue_error_rate_correlated(resolved_issue, issue)
        is_commit_correlated = is_issue_commit_correlated(
            resolved_issue.id, issue.id, resolved_issue.project.id
        )
        if is_rate_correlated and is_commit_correlated:
            correlated_issues.append(issue)
        analytics.record(
            "suspect_resolution.evaluation",
            resolved_group_id=resolved_issue.id,
            candidate_group_id=issue.id,
            resolved_group_resolution_type=resolution_type,
            pearson_r_coefficient=coefficient,
            pearson_r_start_time=start_time,
            pearson_r_end_time=end_time,
            pearson_r_resolution_time=resolution_time,
            is_commit_correlated=is_commit_correlated,
        )

    return correlated_issues
