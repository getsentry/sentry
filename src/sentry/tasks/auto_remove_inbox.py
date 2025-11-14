from typing import int
from sentry.db.deletion import BulkDeleteQuery
from sentry.models.groupinbox import GroupInbox
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks


@instrumented_task(
    name="sentry.tasks.auto_remove_inbox",
    namespace=issues_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.REGION,
)
def auto_remove_inbox() -> None:
    BulkDeleteQuery(model=GroupInbox, days=7, dtfield="date_added").execute()
