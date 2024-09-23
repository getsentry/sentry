import logging

import grpc
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2 import (
    COMPLETE,
    GetTaskRequest,
    SetTaskResultRequest,
    Status,
    Task,
)
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2_grpc import ConsumerStub

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
        self.stub = ConsumerStub(self.channel)

    def get_task(self, partition: int | None = None, topic: str | None = None) -> Task | None:
        logger.info("getting_latest_tasks", extra={"partition": partition, "topic": topic})
        request = GetTaskRequest(partition=partition, topic=topic)
        response = self.stub.GetTask(request)
        if response.HasField("task"):
            return response.task
        return None

    def set_task_status(self, task_id: int, task_status: Status.ValueType):
        request = SetTaskResultRequest(store_id=task_id, status=task_status)
        self.stub.SetTaskResult(request)

    def complete_task(self, task_id: int):
        self.set_task_status(task_id=task_id, task_status=COMPLETE)


task_client = TaskClient()
