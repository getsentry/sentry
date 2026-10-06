import logging
from typing import Any

from django.dispatch import receiver

from sentry import features
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.trigger import is_issue_eligible_for_seer_automation
from sentry.seer.autofix.utils import is_seer_seat_based_tier_enabled
from sentry.signals import issue_assigned
from sentry.tasks.seer.autofix import summarize_issue

logger = logging.getLogger(__name__)


@receiver(issue_assigned, weak=False)
def dispatch_first_assignment_summary(
    project: Project,
    group: Group,
    is_first_assignment: bool = False,
    **kwargs: Any,
) -> None:
    if not is_first_assignment or not features.has(
        "organizations:issue-summary-on-first-assignment", project.organization
    ):
        return

    if is_seer_seat_based_tier_enabled(project.organization):
        logger.info(
            "seer.issue_summary.first_assignment.skipped_seat_based_seer",
            extra={
                "organization_id": project.organization_id,
                "project_id": project.id,
                "group_id": group.id,
            },
        )
        return
    if is_issue_eligible_for_seer_automation(group):
        logger.info(
            "seer.issue_summary.first_assignment.skipped_automation_eligible",
            extra={
                "organization_id": project.organization_id,
                "project_id": project.id,
                "group_id": group.id,
            },
        )
        return

    summarize_issue.delay(
        group.id,
        source=SeerAutomationSource.FIRST_ASSIGNMENT.value,
    )
    logger.info(
        "seer.issue_summary.first_assignment.enqueued",
        extra={
            "organization_id": project.organization_id,
            "project_id": project.id,
            "group_id": group.id,
        },
    )
