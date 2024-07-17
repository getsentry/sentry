import logging
from datetime import datetime, timedelta

from sentry.autofix.utils import AutofixStatus, get_autofix_state
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.autofix.check_autofix_status",
    max_retries=1,
)
def check_autofix_status(run_id: int):
    state = get_autofix_state(run_id=run_id)

    if (
        state
        and state.status == AutofixStatus.PROCESSING
        and state.updated_at < datetime.now() - timedelta(minutes=5)
    ):
        logger.error("Autofix run %s has been processing for more than 5 minutes", run_id)
