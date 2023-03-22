from typing import Union

from sentry import options
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models import Project
from sentry.models.group import Group
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


def can_create_group(
    entity: Union[IssueOccurrence, PerformanceProblem, Group], project: Project
) -> bool:
    type_id = entity.type if isinstance(entity, Group) else entity.type.type_id
    return bool(
        # create N+1 db query issues first
        type_id == PerformanceNPlusOneGroupType.type_id
        # system-wide option
        and options.get("performance.issues.create_issues_through_platform", False)
        # more-granular per-project option
        and project.get_option("sentry:performance_issue_create_issue_through_platform", False)
    )


def write_occurrence_to_platform(performance_problem: PerformanceProblem, project: Project) -> bool:
    return bool(
        # handle only N+1 db query detector first
        performance_problem.type.type_id == PerformanceNPlusOneGroupType.type_id
        # system-wide option
        and options.get("performance.issues.send_to_issues_platform", False)
        # more-granular per-project option
        and project.get_option("sentry:performance_issue_send_to_issues_platform", False)
    )
