import logging

import grpc
from sentry_protos.sentry.v1.taskworker_pb2 import (
    FetchNextTask,
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

    def get_task(self, namespace: str | None = None) -> TaskActivation | None:
        """
        Fetch a pending task.

        If a namespace is provided, only tasks for that namespace will be fetched.
        This will return None if there are no tasks to fetch.
        """
        request = GetTaskRequest(namespace=namespace)
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
        self, task_id: str, status: TaskActivationStatus.ValueType, fetch_next_task: FetchNextTask
    ) -> TaskActivation | None:
        """
        Update the status for a given task activation.

        The return value is the next task that should be executed.
        """
        request = SetTaskStatusRequest(
            id=task_id,
            status=status,
            fetch_next_task=fetch_next_task,
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
