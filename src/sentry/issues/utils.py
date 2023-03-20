from typing import Any, Mapping

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models import Project
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


def can_create_group(
    ocurrence: IssueOccurrence, options: Mapping[str, Any], project: Project
) -> bool:
    return (
        # create N+1 db query issues first
        ocurrence.type.type_id == PerformanceNPlusOneGroupType.type_id
        # system-wide option
        and options.get("performance.issues.create_issues_through_platform", False)
        # more-granular per-project option
        and project.get_option("sentry:performance_issue_create_issue_through_platform", False)
    )


def write_occurrence_to_platform(
    performance_problem: PerformanceProblem, options: Mapping[str, Any], project: Project
) -> bool:
    return (
        # handle only N+1 db query detector first
        performance_problem.type.type_id == PerformanceNPlusOneGroupType.type_id
        # system-wide option
        and options.get("performance.issues.send_to_issues_platform", False)
        # more-granular per-project option
        and project.get_option("sentry:performance_issue_send_to_issues_platform", False)
    )
