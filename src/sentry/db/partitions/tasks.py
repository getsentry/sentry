from sentry.db.partitions import manager
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import db_control_tasks, db_tasks

# Each silo's task maintains the range partitioned tables of its own models only, so
# the two don't overlap in a monolith, which runs both.


@instrumented_task(
    name="sentry.db.partitions.tasks.maintain_partitions",
    namespace=db_tasks,
    processing_deadline_duration=30 * 60,
    silo_mode=SiloMode.CELL,
)
def maintain_partitions() -> None:
    """Create upcoming range partitions and drop expired ones for cell silo models."""
    manager.maintain_partitions(SiloMode.CELL)


@instrumented_task(
    name="sentry.db.partitions.tasks.maintain_partitions_control",
    namespace=db_control_tasks,
    processing_deadline_duration=30 * 60,
    silo_mode=SiloMode.CONTROL,
)
def maintain_partitions_control() -> None:
    """Create upcoming range partitions and drop expired ones for control silo models."""
    manager.maintain_partitions(SiloMode.CONTROL)
