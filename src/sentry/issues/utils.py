from typing import Any, Mapping

from sentry.issues.grouptype import GroupCategory, get_group_types_by_category
from sentry.issues.issue_occurrence import IssueOccurrenceData
from sentry.models import Project


def skip_group_processing(
    occurrence: IssueOccurrenceData, options: Mapping[str, Any], project: Project
) -> bool:
    return (
        occurrence.type.type_id in get_group_types_by_category(GroupCategory.PERFORMANCE.value)
        and options.get("performance.issues.send_to_issues_platform", False)
        and project.get_option("sentry:performance_issue_send_to_issues_platform", False)
    )
