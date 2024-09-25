from __future__ import annotations

import logging
import time
from concurrent import futures

import grpc
import orjson
from django.conf import settings
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    DispatchRequest,
    DispatchResponse,
)
from sentry_protos.sentry.v1alpha.taskworker_pb2_grpc import (
    WorkerServiceServicer as BaseWorkerServiceServicer,
)
from sentry_protos.sentry.v1alpha.taskworker_pb2_grpc import add_WorkerServiceServicer_to_server

from sentry.taskworker.config import TaskNamespace, taskregistry

logger = logging.getLogger("sentry.taskworker")
result_logger = logging.getLogger("taskworker.results")


class WorkerServicer(BaseWorkerServiceServicer):
    __namespace: TaskNamespace | None = None

    def __init__(self, **options) -> None:
        super().__init__()
        self.options = options
        self.do_imports()

    @property
    def namespace(self) -> TaskNamespace:
        if self.__namespace:
            return self.__namespace

        name = self.options["namespace"]
        self.__namespace = taskregistry.get(name)
        return self.__namespace

    def do_imports(self) -> None:
        for module in settings.TASKWORKER_IMPORTS:
            __import__(module)

    def Dispatch(self, request: DispatchRequest, _) -> DispatchResponse:
        activation = request.task_activation
        try:
            task_meta = self.namespace.get(activation.taskname)
        except KeyError:
            logger.exception("Could not resolve task with name %s", activation.taskname)
            return

        # TODO: Check idempotency
        task_added_time = activation.received_at.seconds
        execution_time = time.time()
        next_state = TASK_ACTIVATION_STATUS_FAILURE
        try:
            task_data_parameters = orjson.loads(activation.parameters)
            task_meta(*task_data_parameters["args"], **task_data_parameters["kwargs"])
            next_state = TASK_ACTIVATION_STATUS_COMPLETE
        except Exception as err:
            logger.info("taskworker.task_errored", extra={"error": str(err)})
            # TODO check retry policy
            if task_meta.should_retry(activation.retry_state, err):
                logger.info("taskworker.task.retry", extra={"task": activation.taskname})
                next_state = TASK_ACTIVATION_STATUS_RETRY
        task_latency = execution_time - task_added_time

        # Dump results to a log file that is CSV shaped
        result_logger.info(
            "task.complete, %s, %s, %s", task_added_time, execution_time, task_latency
        )

        return DispatchResponse(status=next_state)


def serve(**options):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    add_WorkerServiceServicer_to_server(WorkerServicer(**options), server)
    server.add_insecure_port("[::]:50051")
    server.start()
    server.wait_for_termination()
