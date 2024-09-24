import logging
from concurrent.futures import ThreadPoolExecutor

import grpc
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    AddTaskRequest,
    AddTaskResponse,
    GetTaskRequest,
    GetTaskResponse,
    SetTaskStatusRequest,
    SetTaskStatusResponse,
)
from sentry_protos.sentry.v1alpha.taskworker_pb2_grpc import (
    ConsumerServiceServicer as BaseConsumerServicer,
)
from sentry_protos.sentry.v1alpha.taskworker_pb2_grpc import add_ConsumerServiceServicer_to_server

from sentry.taskworker.pending_task_store import PendingTaskStore

logger = logging.getLogger("sentry.taskworker.grpc_server")


class ConsumerServicer(BaseConsumerServicer):
    def __init__(self) -> None:
        super().__init__()
        self.pending_task_store = PendingTaskStore()

    def GetTask(self, request: GetTaskRequest, context) -> GetTaskResponse:
        inflight = self.pending_task_store.get_pending_task()
        if not inflight:
            return GetTaskResponse()
        return GetTaskResponse(task=inflight.activation)

    def SetTaskStatus(self, request: SetTaskStatusRequest, context) -> SetTaskStatusResponse:
        logger.info("update status", extra={"id": request.id})
        # TODO handle fetch_next to read another task
        self.pending_task_store.set_task_status(task_id=request.id, task_status=request.status)
        return SetTaskStatusResponse()

    def AddTask(self, request: AddTaskRequest, context) -> AddTaskResponse:
        return AddTaskResponse(ok=False, error="Not implemented")


def serve():
    server = grpc.server(ThreadPoolExecutor(max_workers=4))
    add_ConsumerServiceServicer_to_server(ConsumerServicer(), server)
    server.add_insecure_port("[::]:50051")
    server.start()
    server.wait_for_termination()
