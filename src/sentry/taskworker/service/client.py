import logging

import grpc
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    GetTaskRequest,
    GetTaskResponse,
    SetTaskStatusRequest,
    SetTaskStatusResponse,
    TaskActivationStatus,
)
from sentry_protos.sentry.v1alpha.taskworker_pb2_grpc import ConsumerServiceStub

from sentry.taskworker.pending_task_store import PendingTaskStore

logger = logging.getLogger("sentry.taskworker")


class TaskClient:
    """
    Emulate an RPC style interface

    This interface is the 'worker process' interface for
    fetching and updating state on tasks. Worker processes
    can rely on this interface to be stable.
    """

    def __init__(self):
        self.pending_task_store = PendingTaskStore()
        self.host = "localhost"
        self.server_port = 50051
        self.channel = grpc.insecure_channel(f"{self.host}:{self.server_port}")
        self.stub = ConsumerServiceStub(self.channel)

    def get_task(
        self, partition: int | None = None, topic: str | None = None
    ) -> GetTaskResponse | None:
        logger.info("getting_latest_tasks", extra={"partition": partition, "topic": topic})
        request = GetTaskRequest()
        response = self.stub.GetTask(request)
        if response.HasField("task") and response.HasField("processing_deadline"):
            return response
        return None

    def set_task_status(
        self, task_id: str, task_status: TaskActivationStatus.ValueType
    ) -> SetTaskStatusResponse:
        request = SetTaskStatusRequest(id=task_id, status=task_status, fetch_next=True)
        return self.stub.SetTaskStatus(request)

    def complete_task(self, task_id: str) -> SetTaskStatusResponse:
        return self.set_task_status(task_id=task_id, task_status=TASK_ACTIVATION_STATUS_COMPLETE)


task_client = TaskClient()
