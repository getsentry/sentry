import logging
import time

import grpc
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_PENDING,
    DispatchRequest,
)
from sentry_protos.sentry.v1alpha.taskworker_pb2_grpc import WorkerServiceStub

from sentry.taskworker.pending_task_store import PendingTaskStore

logger = logging.getLogger("sentry.taskworker.grpc_server")


class ConsumerGrpc:
    def __init__(self) -> None:
        self.pending_task_store = PendingTaskStore()
        self.host = "localhost"
        self.server_port = 50051
        self.channel = grpc.insecure_channel(f"{self.host}:{self.server_port}")
        self.stub = WorkerServiceStub(self.channel)

    def start(self):
        while True:
            self.dispatch_task()

    def dispatch_task(self):
        in_flight_activation = self.pending_task_store.get_pending_task()
        if not in_flight_activation:
            logger.info("No tasks")
            time.sleep(1)
            return
        try:
            dispatch_task_response = self.stub.Dispatch(
                DispatchRequest(task_activation=in_flight_activation.activation)
            )
            self.pending_task_store.set_task_status(
                task_id=in_flight_activation.activation.id,
                task_status=dispatch_task_response.status,
            )
        except grpc.RpcError as rpc_error:
            logger.exception(
                "Connection lost with worker, code: %s, details: %s",
                rpc_error.code(),
                rpc_error.details(),
            )
            self.pending_task_store.set_task_status(
                task_id=in_flight_activation.activation.id,
                task_status=TASK_ACTIVATION_STATUS_PENDING,
            )
            time.sleep(1)


def start():
    consumer_grpc = ConsumerGrpc()
    consumer_grpc.start()
