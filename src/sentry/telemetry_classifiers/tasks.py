from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_classifiers_tasks


@instrumented_task(
    name="sentry.telemetry_classifiers.tasks.schedule_conversation_classifiers",
    namespace=telemetry_classifiers_tasks,
    expires=300,
    silo_mode=SiloMode.CELL,
)
def schedule_conversation_classifiers() -> None:
    """Schedule scans for configured conversation classifiers."""
