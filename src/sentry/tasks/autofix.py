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
    name="sentry.tasks.autofix.start_seer_automation",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=35,
    retry=Retry(times=1),
)
def start_seer_automation(group_id: int) -> None:
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
    get_issue_summary(
        group=group, source=SeerAutomationSource.POST_PROCESS, should_run_automation=False
    )
