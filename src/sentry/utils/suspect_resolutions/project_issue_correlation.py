from typing import Set

from sentry.models import Group
from sentry.utils.suspect_resolutions.commit_correlation import is_issue_commit_correlated
from sentry.utils.suspect_resolutions.metric_correlation import is_issue_error_rate_correlated


def get_project_issues_with_correlated_commits_and_error_rate(
    project_id: int, resolved_issue: Group
) -> Set:
    if not Group.objects.filter(id=resolved_issue.id).exists():
        return set()

    all_project_issues = list(
        Group.objects.filter(project=project_id).exclude(id=resolved_issue.id)
    )

    correlated_issues = {
        issue.id
        for issue in all_project_issues
        if is_issue_commit_correlated(resolved_issue.id, issue.id)
        and is_issue_error_rate_correlated(resolved_issue, issue)
    }

    return correlated_issues
