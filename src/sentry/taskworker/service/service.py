from django.db import router, transaction

from sentry.taskworker.models import PendingTasks
from sentry.taskworker.service.models import RpcTask, serialize_task


class TaskService:
    """
    Emulate an RPC style interface

    This interface is the 'worker process' interface for
    fetching and updating state on tasks. Worker processes
    can rely on this interface to be stable.
    """

    def get_task(self, *, partition: int | None = None, topic: str | None = None) -> RpcTask | None:

        with transaction.atomic(using=router.db_for_write(PendingTasks)):
            query_set = PendingTasks.objects.filter(state=PendingTasks.States.PENDING)

            if partition is not None:
                query_set = query_set.filter(partition=partition)

            if topic is not None:
                query_set = query_set.filter(topic=topic)

            task = query_set.first()
            if task is None:
                return None

            task.update(state=PendingTasks.States.PROCESSING)
            return serialize_task(task)

    def set_task_status(self, *, task_id: int, task_status: PendingTasks.States) -> RpcTask | None:
        try:
            with transaction.atomic(using=router.db_for_write(PendingTasks)):
                task = PendingTasks.objects.filter(id=task_id).get()

                # TODO add state machine validtion/logging
                if task.state != PendingTasks.States.COMPLETE:
                    task.update(state=task_status)
                return serialize_task(task)
        except PendingTasks.DoesNotExist:
            return None

    def complete_task(self, *, task_id: int) -> RpcTask | None:
        return self.set_task_status(task_id=task_id, task_status=PendingTasks.States.COMPLETE)


task_service = TaskService()
