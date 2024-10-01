from __future__ import annotations

import logging
import time
from datetime import datetime
from multiprocessing.pool import Pool

import grpc
import orjson
from django.conf import settings
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    GetTaskResponse,
)

from sentry.taskworker import worker_process
from sentry.taskworker.config import TaskNamespace, taskregistry

logger = logging.getLogger("sentry.taskworker")
result_logger = logging.getLogger("taskworker.results")


class Worker:
    __namespace: TaskNamespace | None = None

    def __init__(self, **options):
        self.options = options
        self.exitcode = None

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

    def start(self) -> None:
        self.do_imports()
        try:
            while True:
                self.process_tasks(self.namespace)
        except KeyboardInterrupt:
            self.exitcode = 1
        except Exception:
            logger.exception("Worker process crashed")

    def process_tasks(self, namespace: TaskNamespace) -> None:
        from sentry.taskworker.service.client import task_client

        try:
            response: GetTaskResponse | None = task_client.get_task(topic=namespace.topic)
        except grpc.RpcError:
            logger.info("get_task failed. Retrying in 1 second")
            time.sleep(1)
            return

        if not response:
            logger.info("No tasks")
            time.sleep(1)
            return

        activation = response.task
        processing_deadline = response.processing_deadline

        if not self.namespace.contains(activation.taskname):
            logger.exception("Could not resolve task with name %s", activation.taskname)
            return

        # TODO: Check idempotency
        task_added_time = activation.received_at.seconds
        execution_time = time.time()
        next_state = TASK_ACTIVATION_STATUS_FAILURE
        try:
            task_data_parameters = orjson.loads(activation.parameters)
            with Pool(processes=1) as pool:
                result = pool.apply_async(
                    worker_process._process_activation,
                    (
                        self.options["namespace"],
                        activation.taskname,
                        task_data_parameters["args"],
                        task_data_parameters["kwargs"],
                    ),
                )
                result.get(
                    timeout=(processing_deadline.ToDatetime() - datetime.now()).total_seconds()
                )
            next_state = TASK_ACTIVATION_STATUS_COMPLETE
        except Exception as err:
            logger.info("taskworker.task_errored", extra={"error": str(err)})
            # TODO check retry policy
            if self.namespace.get(activation.taskname).should_retry(activation.retry_state, err):
                logger.info("taskworker.task.retry", extra={"task": activation.taskname})
                next_state = TASK_ACTIVATION_STATUS_RETRY
        task_latency = execution_time - task_added_time

        # Dump results to a log file that is CSV shaped
        result_logger.info(
            "task.complete, %s, %s, %s", task_added_time, execution_time, task_latency
        )

        if next_state == TASK_ACTIVATION_STATUS_COMPLETE:
            logger.info(
                "taskworker.task.complete", extra={"task": activation.taskname, "id": activation.id}
            )
            task_client.complete_task(task_id=activation.id)
        else:
            logger.info(
                "taskworker.task.change_status",
                extra={"task": activation.taskname, "state": next_state},
            )
            task_client.set_task_status(
                task_id=activation.id,
                task_status=next_state,
            )
