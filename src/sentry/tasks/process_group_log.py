from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks


@instrumented_task(
    name="sentry.tasks.process_group_log",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def process_group_log_task(group_id: int) -> None:
    from sentry.issues.derived.processing import process_group_log

    process_group_log(group_id)
