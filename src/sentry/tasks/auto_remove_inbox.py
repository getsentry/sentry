from sentry.db.deletion import BulkDeleteQuery
from sentry.models.groupinbox import GroupInbox
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import issues_tasks


@instrumented_task(
    name="sentry.tasks.auto_remove_inbox",
    time_limit=120,
    soft_time_limit=110,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=issues_tasks,
        processing_deadline_duration=120,
    ),
)
def auto_remove_inbox():
    BulkDeleteQuery(model=GroupInbox, days=7, dtfield="date_added").execute()
