from django.db import transaction

from sentry.taskworker.models import PendingTasks, State
from sentry.taskworker.service.models import RpcTask, serialize_task


class TaskService:
    def get_task(self, *partition: int | None, topic: str | None) -> RpcTask | None:
        query_set = PendingTasks.objects.filter(state=State.PENDING).limit(1)

        if partition is not None:
            query_set = query_set.filter(partition=partition)

        if topic is not None:
            query_set = query_set.filter(topic=topic)

        task = query_set.get()

        return serialize_task(task)

    def set_task_status(self, *, task_id: int, task_status: State) -> RpcTask | None:
        try:
            with transaction.atomic():
                task = PendingTasks.objects.filter(id=task_id).get()

                if task_status != State.COMPLETE:
                    task.update(state=task_status)
                return serialize_task(task)
        except PendingTasks.DoesNotExist:
            return None

    def complete_task(self, *, task_id: int) -> RpcTask | None:
        return self.set_task_status(task_id=task_id, task_status=State.COMPLETE)


task_service = TaskService()
