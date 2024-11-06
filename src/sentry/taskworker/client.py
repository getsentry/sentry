import logging

import grpc
from sentry_protos.sentry.v1.taskworker_pb2 import (
    GetTaskRequest,
    SetTaskStatusRequest,
    TaskActivation,
    TaskActivationStatus,
)
from sentry_protos.sentry.v1.taskworker_pb2_grpc import ConsumerServiceStub

logger = logging.getLogger("sentry.taskworker.client")


class TaskworkerClient:
    """
    Taskworker RPC client wrapper

    TODO(taskworker): Implement gRPC client logic.
    """

    def __init__(self, host: str) -> None:
        self._host = host
        self._stub: ConsumerServiceStub | None = None

    @property
    def _client(self) -> ConsumerServiceStub:
        if self._stub:
            return self._stub

        # TODO(taskworker) Need to add service account credentials
        self._channel = grpc.insecure_channel(self._host)
        self._stub = ConsumerServiceStub(self._channel)
        return self._stub

    def get_task(self) -> TaskActivation | None:
        request = GetTaskRequest()
        response = self._client.GetTask(request)
        if response.HasField("task"):
            return response.task
        return None

    def update_task(
        self, task_id: str, status: TaskActivationStatus.ValueType, fetch_next: bool = True
    ) -> TaskActivation | None:
        """
        Update the status for a given task activation.

        The return value is the next task that should be executed.
        """
        request = SetTaskStatusRequest(
            id=task_id,
            status=status,
            fetch_next=fetch_next,
        )
        response = self._client.SetTaskStatus(request)
        if response.HasField("error"):
            raise RuntimeError(response.error)
        return response.task
