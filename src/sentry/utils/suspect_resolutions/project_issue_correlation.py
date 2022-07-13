from sentry.models import Group
from sentry.utils.types import Sequence


def get_project_issues_with_correlated_commits_and_error_rate(
    project_id: int, resolved_issue_id: int
) -> Sequence[int]:
    # for the given project and issue, scan all the issues within a project to
    # see whether they're:  (commit-correlated and error-rate-correlated)

    all_project_issues = Group.objects.filter(project=project_id).values_list("id", flat=True)

    correlated_issues = []

    for issue in all_project_issues:
        if is_issue_commit_correlated(resolved_issue_id, issue) and is_issue_error_rate_correlated(
            resolved_issue_id, issue
        ):
            correlated_issues.append(issue)

    return correlated_issues
