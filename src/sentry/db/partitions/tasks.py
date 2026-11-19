from sentry.db.partitions import manager
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import db_control_tasks, db_tasks

# Each silo maintains the range partitioned tables of its own models. Models of the
# other silo aren't available there and are skipped.


@instrumented_task(
    name="sentry.db.partitions.tasks.maintain_partitions",
    namespace=db_tasks,
    processing_deadline_duration=30 * 60,
    silo_mode=SiloMode.CELL,
)
def maintain_partitions() -> None:
    """Create upcoming range partitions and drop expired ones, in a cell silo."""
    manager.maintain_partitions()


@instrumented_task(
    name="sentry.db.partitions.tasks.maintain_partitions_control",
    namespace=db_control_tasks,
    processing_deadline_duration=30 * 60,
    silo_mode=SiloMode.CONTROL,
)
def maintain_partitions_control() -> None:
    """Create upcoming range partitions and drop expired ones, in the control silo."""
    manager.maintain_partitions()
