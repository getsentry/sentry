from concurrent.futures import ThreadPoolExecutor

import grpc
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2 import (
    CompleteTaskRequest,
    CompleteTaskResponse,
    GetTaskRequest,
    GetTaskResponse,
    SetTaskResultRequest,
    SetTaskResultResponse,
)
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2_grpc import (
    ConsumerServicer as BaseConsumerServicer,
)
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2_grpc import (
    add_ConsumerServicer_to_server,
)

from sentry.taskworker.pending_task_store import PendingTaskStore


class ConsumerServicer(BaseConsumerServicer):
    def __init__(self) -> None:
        super().__init__()
        self.pending_task_store = PendingTaskStore()

    def GetTask(self, request: GetTaskRequest, context) -> GetTaskResponse:
        task = self.pending_task_store.get_pending_task(
            request.partition if request.partition else None,
            request.topic if request.topic else None,
        )
        return GetTaskResponse(task=task)

    def SetTaskResult(self, request: SetTaskResultRequest, context) -> SetTaskResultResponse:
        self.pending_task_store.set_task_status(
            task_id=request.store_id, task_status=request.status
        )
        return SetTaskResultResponse()

    def CompleteTask(self, request: CompleteTaskRequest, context) -> CompleteTaskResponse:
        self.set_task_status(task_id=CompleteTaskRequest.store_id)
        return CompleteTaskResponse()


def serve():
    server = grpc.server(ThreadPoolExecutor(max_workers=4))
    add_ConsumerServicer_to_server(ConsumerServicer(), server)
    server.add_insecure_port("[::]:50051")
    server.start()
    server.wait_for_termination()
