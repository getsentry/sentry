from sentry.db.partitions import manager
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import db_tasks


@instrumented_task(
    name="sentry.db.partitions.tasks.maintain_partitions",
    namespace=db_tasks,
    processing_deadline_duration=30 * 60,
    silo_mode=SiloMode.CELL,
)
def maintain_partitions() -> None:
    """Create upcoming range partitions and drop expired ones."""
    manager.maintain_partitions()
