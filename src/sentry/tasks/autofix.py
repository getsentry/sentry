import logging
from datetime import datetime, timedelta

from sentry.models.group import Group
from sentry.seer.autofix.constants import AutofixStatus, SeerAutomationSource
from sentry.seer.autofix.utils import get_autofix_state
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ingest_errors_tasks, issues_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.autofix.check_autofix_status",
    namespace=issues_tasks,
    retry=Retry(times=1),
)
def check_autofix_status(run_id: int, organization_id: int) -> None:
    state = get_autofix_state(run_id=run_id, organization_id=organization_id)

    if (
        state
        and state.status == AutofixStatus.PROCESSING
        and state.updated_at < datetime.now() - timedelta(minutes=5)
    ):
        # This should log to sentry
        logger.error(
            "Autofix run has been processing for more than 5 minutes", extra={"run_id": run_id}
        )


@instrumented_task(
    name="sentry.tasks.autofix.generate_summary_and_run_automation",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=35,
    retry=Retry(times=1),
)
def generate_summary_and_run_automation(group_id: int) -> None:
    from sentry.seer.autofix.issue_summary import get_issue_summary

    group = Group.objects.get(id=group_id)
    get_issue_summary(group=group, source=SeerAutomationSource.POST_PROCESS)


@instrumented_task(
    name="sentry.tasks.autofix.generate_issue_summary_only",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=35,
    retry=Retry(times=1),
)
def generate_issue_summary_only(group_id: int) -> None:
    """
    Generate issue summary WITHOUT triggering automation.
    Used for triage signals flow when event count < 10 or when summary doesn't exist yet.
    """
    from sentry.seer.autofix.issue_summary import get_issue_summary

    group = Group.objects.get(id=group_id)
    logger.info("Task: generate_issue_summary_only, group_id=%s", group_id)
    get_issue_summary(
        group=group, source=SeerAutomationSource.POST_PROCESS, should_run_automation=False
    )
    # TODO: Generate fixability score here and check for it in run_automation around line 316
    # That will make sure that even after adding fixability here it's not re-triggered.
    # Currently fixability will only be generated after 10 events when run_automation is called


@instrumented_task(
    name="sentry.tasks.autofix.run_automation_only_task",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=35,
    retry=Retry(times=1),
)
def run_automation_only_task(group_id: int) -> None:
    """
    Run automation directly for a group (assumes summary and fixability already exist).
    Used for triage signals flow when event count >= 10 and summary exists.
    """
    from django.contrib.auth.models import AnonymousUser

    from sentry.seer.autofix.issue_summary import run_automation

    group = Group.objects.get(id=group_id)
    logger.info("Task: run_automation_only_task, group_id=%s", group_id)

    event = group.get_latest_event()

    if not event:
        logger.warning("run_automation_only_task.no_event_found", extra={"group_id": group_id})
        return

    run_automation(
        group=group, user=AnonymousUser(), event=event, source=SeerAutomationSource.POST_PROCESS
    )
