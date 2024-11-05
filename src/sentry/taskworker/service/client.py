import logging

from sentry_protos.sentry.v1.taskworker_pb2 import TaskActivation, TaskActivationStatus

logger = logging.getLogger("sentry.taskworker.client")


class TaskClient:
    """
    Taskworker RPC client wrapper

    TODO(taskworker): Implement gRPC client logic.
    """

    def __init__(self, host: str) -> None:
        self._host = host

    def get_task(self) -> TaskActivation | None:
        return None

    def update_task(
        self, task_id: str, status: TaskActivationStatus.ValueType
    ) -> TaskActivation | None:
        """
        Update the status for a given task activation.

        The return value is the next task that should be executed.
        """
        return None
