from __future__ import annotations

from typing import TYPE_CHECKING, Union

from sentry import options
from sentry.issues.grouptype import GroupCategory, get_group_type_by_type_id
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData
from sentry.models.group import Group
from sentry.utils.performance_issues.performance_problem import PerformanceProblem

if TYPE_CHECKING:
    from sentry.models import Project


def can_create_group(
    entity: Union[IssueOccurrence, IssueOccurrenceData, PerformanceProblem, Group], project: Project
) -> bool:
    if isinstance(entity, dict):
        group_type = get_group_type_by_type_id(entity["type"])
    elif isinstance(entity, Group):
        group_type = entity.issue_type
    else:
        group_type = entity.type
    return issue_category_can_create_group(GroupCategory(group_type.category), project)


def issue_category_can_create_group(category: GroupCategory, project: Project) -> bool:
    return bool(
        category != GroupCategory.PERFORMANCE
        or (
            category == GroupCategory.PERFORMANCE
            # system-wide option
            and options.get("performance.issues.create_issues_through_platform", False)
            # more-granular per-project option
            and project.get_option("sentry:performance_issue_create_issue_through_platform", True)
        )
    )


def write_occurrence_to_platform(performance_problem: PerformanceProblem, project: Project) -> bool:
    return bool(
        performance_problem.type.category == GroupCategory.PERFORMANCE.value
        # system-wide option
        and options.get("performance.issues.send_to_issues_platform", False)
        # more-granular per-project option
        and project.get_option("sentry:performance_issue_send_to_issues_platform", True)
    )
