import logging
from datetime import datetime, timedelta

from sentry.autofix.utils import AutofixStatus, SeerAutomationSource, get_autofix_state
from sentry.models.group import Group
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import ingest_errors_tasks, issues_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.autofix.check_autofix_status",
    max_retries=1,
    taskworker_config=TaskworkerConfig(
        namespace=issues_tasks,
        retry=Retry(
            times=1,
        ),
    ),
)
def check_autofix_status(run_id: int):
    state = get_autofix_state(run_id=run_id)

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
    queue="seer.seer_automation",
    max_retries=1,
    time_limit=30,
    soft_time_limit=25,
    taskworker_config=TaskworkerConfig(
        namespace=ingest_errors_tasks,
        processing_deadline_duration=35,
        retry=Retry(
            times=1,
        ),
    ),
)
def start_seer_automation(group_id: int):
    from sentry.seer.issue_summary import get_issue_summary

    group = Group.objects.get(id=group_id)
    get_issue_summary(group=group, source=SeerAutomationSource.POST_PROCESS)
