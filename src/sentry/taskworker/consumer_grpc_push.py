"""
This module is gRPC client that pushes tasks to the taskworker.
"""

import logging
import time
from collections import deque
from collections.abc import Iterable
from concurrent.futures import FIRST_COMPLETED, wait
from concurrent.futures.thread import ThreadPoolExecutor

import grpc
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_PENDING,
    DispatchRequest,
    InflightActivation,
)
from sentry_protos.sentry.v1alpha.taskworker_pb2_grpc import WorkerServiceStub

from sentry.taskworker.pending_task_store import PendingTaskStore

logger = logging.getLogger("sentry.taskworker.grpc_server")


class ConsumerGrpc:
    def __init__(self, worker_addrs: Iterable[str]) -> None:
        self.pending_task_store = PendingTaskStore()
        self.available_stubs = deque(
            [WorkerServiceStub(grpc.insecure_channel(worker_addr)) for worker_addr in worker_addrs]
        )
        self.current_connections = set()

    def start(self):
        with ThreadPoolExecutor(max_workers=len(self.available_stubs)) as executor:
            logger.info("Starting consumer grpc with %s threads", len(self.available_stubs))
            while True:
                if len(self.available_stubs) == 0:
                    done, not_done = wait(self.current_connections, return_when=FIRST_COMPLETED)
                    self.available_stubs.extend([future.result() for future in done])
                    self.current_connections = not_done

                self.current_connections.add(
                    executor.submit(
                        self._dispatch_activation,
                        self.available_stubs.popleft(),
                        self._poll_pending_task(),
                    )
                )

    def _poll_pending_task(self) -> InflightActivation:
        while True:
            inflight_activation = self.pending_task_store.get_pending_task()
            if inflight_activation:
                logger.info("Polled task %s", inflight_activation.activation.id)
                return inflight_activation
            logger.info("No tasks")
            time.sleep(1)

    def _dispatch_activation(
        self,
        stub: WorkerServiceStub,
        inflight_activation: InflightActivation,
    ) -> WorkerServiceStub:
        try:
            dispatch_task_response = stub.Dispatch(
                DispatchRequest(task_activation=inflight_activation.activation)
            )
            self.pending_task_store.set_task_status(
                task_id=inflight_activation.activation.id,
                task_status=dispatch_task_response.status,
            )
        except grpc.RpcError as rpc_error:
            logger.exception(
                "Connection lost with worker, code: %s, details: %s",
                rpc_error.code(),
                rpc_error.details(),
            )
            self.pending_task_store.set_task_status(
                task_id=inflight_activation.activation.id,
                task_status=TASK_ACTIVATION_STATUS_PENDING,
            )
            self.pending_task_store.set_task_deadline(
                task_id=inflight_activation.activation.id, task_deadline=None
            )
            time.sleep(1)
        return stub


def start(worker_addrs: Iterable[str]):
    consumer_grpc = ConsumerGrpc(worker_addrs)
    consumer_grpc.start()
