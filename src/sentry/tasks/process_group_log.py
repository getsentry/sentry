import logging

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.process_group_log",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def process_group_log_task(group_id: int, **kwargs: object) -> None:
    from sentry.issues.derived.processing import process_group_log
    from sentry.models.group import Group

    try:
        process_group_log(group_id)
    except Group.DoesNotExist:
        logger.info("process_group_log_task.group_not_found", extra={"group_id": group_id})
