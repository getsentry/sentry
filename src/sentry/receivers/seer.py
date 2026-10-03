from typing import Any

from sentry import features
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.autofix.constants import (
    FIRST_ASSIGNMENT_SUMMARY_FEATURE,
    SeerAutomationSource,
)
from sentry.signals import issue_assigned
from sentry.tasks.seer.autofix import summarize_issue


@issue_assigned.connect(weak=False)
def dispatch_first_assignment_summary(
    project: Project,
    group: Group,
    is_first_assignment: bool = False,
    **kwargs: Any,
) -> None:
    if not is_first_assignment or not features.has(
        FIRST_ASSIGNMENT_SUMMARY_FEATURE, project.organization
    ):
        return

    summarize_issue.delay(
        group.id,
        source=SeerAutomationSource.FIRST_ASSIGNMENT,
    )
