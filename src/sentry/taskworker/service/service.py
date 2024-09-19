import logging

from sentry.taskworker.models import PendingTasks
from sentry.taskworker.pending_task_store import PendingTaskStore
from sentry.taskworker.pending_tasks import PendingTask

logger = logging.getLogger("sentry.taskworker")


class TaskService:
    """
    Emulate an RPC style interface

    This interface is the 'worker process' interface for
    fetching and updating state on tasks. Worker processes
    can rely on this interface to be stable.
    """

    def __init__(self):
        self.pending_task_store = PendingTaskStore()

    def get_task(
        self, *, partition: int | None = None, topic: str | None = None
    ) -> PendingTask | None:
        logger.info("getting_latest_tasks", extra={"partition": partition, "topic": topic})
        return self.pending_task_store.get_pending_task(partition, topic)

    def set_task_status(
        self, *, task_id: int, task_status: PendingTasks.States
    ) -> PendingTask | None:
        return self.pending_task_store.set_task_status(task_id=task_id, task_status=task_status)

    def complete_task(self, *, task_id: int) -> PendingTask | None:
        return self.set_task_status(task_id=task_id, task_status=PendingTasks.States.COMPLETE)


task_service = TaskService()
