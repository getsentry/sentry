from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from multiprocessing.context import TimeoutError
from multiprocessing.pool import Pool
from uuid import uuid4

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

from sentry.taskworker import worker_process
from sentry.taskworker.config import TaskNamespace, taskregistry

logger = logging.getLogger("sentry.taskworker")
result_logger = logging.getLogger("taskworker.results")


class WorkerServicer(BaseWorkerServiceServicer):
    __namespace: TaskNamespace | None = None

    def __init__(self, **options) -> None:
        super().__init__()
        self.options = options
        self.do_imports()
        self.__worker_id = uuid4().hex
        self._build_pool()

    def _build_pool(self) -> None:
        self.__pool = Pool(processes=2)

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
        activation = request.activation

        if not self.namespace.contains(activation.taskname):
            logger.exception("Could not resolve task with name %s", activation.taskname)
            return DispatchResponse(status=TASK_ACTIVATION_STATUS_FAILURE)

        # TODO: Check idempotency
        task_added_time = activation.received_at.seconds
        next_state = TASK_ACTIVATION_STATUS_FAILURE
        result = None
        try:
            task_data_parameters = orjson.loads(activation.parameters)
            result = self.__pool.apply_async(
                worker_process._process_activation,
                args=[
                    self.options["namespace"],
                    activation.taskname,
                    task_data_parameters["args"],
                    task_data_parameters["kwargs"],
                ],
            )
            result.get(
                timeout=(request.processing_deadline.ToDatetime() - datetime.now()).total_seconds()
            )
            next_state = TASK_ACTIVATION_STATUS_COMPLETE
        except TimeoutError:
            logger.info("taskworker.task_execution_timeout")
            # When a task times out we kill the entire pool. This is necessary because
            # stdlib multiprocessing.Pool doesn't expose ways to terminate individual tasks.
            self.__pool.terminate()
            self._build_pool()
        except Exception as err:
            logger.info("taskworker.task_errored", extra={"error": str(err)})
            # TODO check retry policy
            if self.namespace.get(activation.taskname).should_retry(activation.retry_state, err):
                logger.info("taskworker.task.retry", extra={"task": activation.taskname})
                next_state = TASK_ACTIVATION_STATUS_RETRY

        execution_time = time.time()
        task_latency = execution_time - task_added_time

        # Dump results to a log file that is CSV shaped
        result_logger.info(
            "task.complete, %s, %s, %s, %s, %s",
            self.__worker_id,
            task_added_time,
            execution_time,
            task_latency,
            activation.id,
        )

        return DispatchResponse(status=next_state)


def serve(port: int, **options):
    logger.info("Starting server on: %s", port)
    server = grpc.server(ThreadPoolExecutor(max_workers=10))
    add_WorkerServiceServicer_to_server(WorkerServicer(**options), server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    server.wait_for_termination()
