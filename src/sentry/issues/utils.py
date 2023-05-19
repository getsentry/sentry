from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import options
from sentry.issues.grouptype import GroupCategory
from sentry.utils.performance_issues.performance_problem import PerformanceProblem

if TYPE_CHECKING:
    from sentry.models import Project


def write_occurrence_to_platform(performance_problem: PerformanceProblem, project: Project) -> bool:
    return bool(
        performance_problem.type.category == GroupCategory.PERFORMANCE.value
        # system-wide option
        and options.get("performance.issues.send_to_issues_platform", False)
    )
