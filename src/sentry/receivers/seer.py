from typing import Any

from sentry import features
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.autofix.constants import FIRST_ASSIGNMENT_SUMMARY_FEATURE
from sentry.signals import issue_assigned


@issue_assigned.connect(weak=False)
def dispatch_first_assignment_summary(
    project: Project,
    group: Group,
    activity_id: int | None = None,
    **kwargs: Any,
) -> None:
    if activity_id is None or not features.has(
        FIRST_ASSIGNMENT_SUMMARY_FEATURE, project.organization
    ):
        return

    from sentry.tasks.seer.autofix import generate_first_assignment_summary

    generate_first_assignment_summary.delay(
        group.id,
        assignment_activity_id=activity_id,
    )
