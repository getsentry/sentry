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
    """

    def __init__(self, host: str) -> None:
        self._host = host

        # TODO(taskworker) Need to support xds bootstrap file
        self._channel = grpc.insecure_channel(self._host)
        self._stub = ConsumerServiceStub(self._channel)

    def get_task(self) -> TaskActivation | None:
        """
        Fetch a pending task

        Will return None when there are no tasks to fetch
        """
        request = GetTaskRequest()
        try:
            response = self._stub.GetTask(request)
        except grpc.RpcError as err:
            if err.code() == grpc.StatusCode.NOT_FOUND:
                return None
            raise
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
        try:
            response = self._stub.SetTaskStatus(request)
        except grpc.RpcError as err:
            if err.code() == grpc.StatusCode.NOT_FOUND:
                return None
            raise
        if response.HasField("task"):
            return response.task
        return None
