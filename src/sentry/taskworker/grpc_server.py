from concurrent.futures import ThreadPoolExecutor

import grpc
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2 import (
    GetTaskRequest,
    SetTaskResultRequest,
)
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2_grpc import (
    ConsumerServicer as BaseConsumerServicer,
)
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2_grpc import (
    add_ConsumerServicer_to_server,
)


class ConsumerServicer(BaseConsumerServicer):
    def GetTask(self, request: GetTaskRequest, context):
        pass

    def SetTaskResult(self, request: SetTaskResultRequest, context):
        pass


def serve():
    server = grpc.server(ThreadPoolExecutor(max_workers=4))
    add_ConsumerServicer_to_server(ConsumerServicer(), server)
    server.add_insecure_port("[::]:50051")
    server.start()
    server.wait_for_termination()
