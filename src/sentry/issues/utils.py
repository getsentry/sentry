from typing import Union

from sentry import options
from sentry.issues.grouptype import GroupCategory, get_group_type_by_type_id
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData
from sentry.models import Project
from sentry.models.group import Group
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


def can_create_group(
    entity: Union[IssueOccurrence, IssueOccurrenceData, PerformanceProblem, Group], project: Project
) -> bool:
    if isinstance(entity, dict):
        group_type = get_group_type_by_type_id(entity["type"])
    elif isinstance(entity, Group):
        group_type = entity.issue_type
    else:
        group_type = entity.type
    return bool(
        group_type.category != GroupCategory.PERFORMANCE.value
        or (
            group_type.category == GroupCategory.PERFORMANCE.value
            # system-wide option
            and options.get("performance.issues.create_issues_through_platform", True)
            # more-granular per-project option
            and project.get_option("sentry:performance_issue_create_issue_through_platform", True)
        )
    )


def write_occurrence_to_platform(performance_problem: PerformanceProblem, project: Project) -> bool:
    return bool(
        performance_problem.type.category == GroupCategory.PERFORMANCE.value
        # system-wide option
        and options.get("performance.issues.send_to_issues_platform", True)
        # more-granular per-project option
        and project.get_option("sentry:performance_issue_send_to_issues_platform", True)
    )
