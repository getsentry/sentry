import logging
from datetime import datetime, timedelta

from sentry.autofix.utils import AutofixStatus, get_autofix_state
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import issues_tasks
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
