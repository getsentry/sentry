from datetime import timedelta
from typing import Sequence

from sentry.models import Activity, Group, GroupStatus
from sentry.utils.suspect_resolutions import analytics
from sentry.utils.suspect_resolutions.commit_correlation import is_issue_commit_correlated
from sentry.utils.suspect_resolutions.metric_correlation import is_issue_error_rate_correlated


def get_suspect_resolutions(resolved_issue: Group) -> Sequence[int]:
    resolution_type = Activity.objects.filter(group=resolved_issue).values_list("type").first()

    if resolved_issue.status != GroupStatus.RESOLVED or resolution_type is None:
        return []

    all_project_issues = list(
        Group.objects.filter(
            status=GroupStatus.UNRESOLVED,
            project=resolved_issue.project,
            last_seen__lte=(resolved_issue.last_seen + timedelta(hours=1)),
            last_seen__gte=(resolved_issue.last_seen - timedelta(hours=1)),
        ).exclude(id=resolved_issue.id)[:100]
    )

    correlated_issue_ids = []
    (
        metric_correlation_results,
        resolution_time,
        start_time,
        end_time,
    ) = is_issue_error_rate_correlated(resolved_issue, all_project_issues)

    for metric_correlation_result in metric_correlation_results:
        (
            is_commit_correlated,
            resolved_issue_release_ids,
            candidate_issue_release_ids,
        ) = is_issue_commit_correlated(
            resolved_issue.id,
            metric_correlation_result.candidate_suspect_resolution_id,
            resolved_issue.project.id,
        )
        if metric_correlation_result.is_correlated and is_commit_correlated:
            correlated_issue_ids.append(metric_correlation_result.candidate_suspect_resolution_id)
        analytics.record(
            "suspect_resolution.evaluation",
            resolved_group_id=resolved_issue.id,
            candidate_group_id=metric_correlation_result.candidate_suspect_resolution_id,
            resolved_group_resolution_type=resolution_type,
            pearson_r_coefficient=metric_correlation_result.coefficient,
            pearson_r_start_time=start_time,
            pearson_r_end_time=end_time,
            pearson_r_resolution_time=resolution_time,
            is_commit_correlated=is_commit_correlated,
            resolved_issue_release_ids=resolved_issue_release_ids,
            candidate_issue_release_ids=candidate_issue_release_ids,
        )

    return correlated_issue_ids
