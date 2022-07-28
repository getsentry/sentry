from typing import Set

from sentry.app import locks
from sentry.models import Group, GroupStatus
from sentry.tasks.base import instrumented_task
from sentry.utils.locking import UnableToAcquireLock
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


@instrumented_task(
    name="sentry.tasks.process_suspect_resolutions",
    queue="get_suspect_resolutions.process_suspect_resolutions",
    default_retry_delay=5,
    max_retries=5,
)
def process_suspect_resolutions(resolved_issue: Group):
    lock = locks.get(
        f"process-suspect-resolutions:{resolved_issue.id}",
        duration=10,
        name="process_suspect_resolutions",
    )
    try:
        with lock.acquire():
            get_suspect_resolutions(resolved_issue)
    except UnableToAcquireLock:
        pass
