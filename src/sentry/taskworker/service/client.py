import logging

from sentry_protos.sentry.v1.taskworker_pb2 import TaskActivationStatus

logger = logging.getLogger("sentry.taskworker")


class TaskClient:
    """
    Dummy TaskClient. TODO: Port over TaskClient
    """

    def __init__(self):
        pass

    def get_task(self, partition: int | None = None, topic: str | None = None) -> None:
        return None

    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType) -> None:
        return None

    def complete_task(self, task_id: str) -> None:
        return None


task_client = TaskClient()
