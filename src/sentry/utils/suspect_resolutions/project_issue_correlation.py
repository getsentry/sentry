from typing import Set

from sentry.models import Group, GroupStatus
from sentry.utils.suspect_resolutions import analytics
from sentry.utils.suspect_resolutions.commit_correlation import is_issue_commit_correlated
from sentry.utils.suspect_resolutions.metric_correlation import is_issue_error_rate_correlated


def get_suspect_resolutions(resolved_issue: Group) -> Set[int]:

    if resolved_issue.status != GroupStatus.RESOLVED:
        return set()

    all_project_issues = list(
        Group.objects.filter(status=GroupStatus.UNRESOLVED).exclude(id=resolved_issue.id)
    )

    for issue in all_project_issues:
        analytics.record(
            "candidate_group.ids",
            resolved_group_id=resolved_issue.id,
            candidate_group_id=issue.id,
        )

    correlated_issue_ids = {
        issue.id
        for issue in all_project_issues
        if is_issue_commit_correlated(resolved_issue.id, issue.id, resolved_issue.project.id)
        and is_issue_error_rate_correlated(resolved_issue, issue)
    }

    if len(correlated_issue_ids) != 0:

        for issue_id in correlated_issue_ids:
            analytics.record(
                "suspect_resolution.ids",
                resolved_group_id=resolved_issue.id,
                suspect_resolution_id=issue_id,
            )

    return correlated_issue_ids
