from __future__ import annotations

import logging
import time
from uuid import uuid4

import grpc
import orjson
from django.conf import settings
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
)

from sentry.taskworker.config import TaskNamespace, taskregistry

logger = logging.getLogger("sentry.taskworker")
result_logger = logging.getLogger("taskworker.results")


class WorkerComplete(Exception):
    ...


class Worker:
    __namespace: TaskNamespace | None = None

    def __init__(self, **options):
        self.options = options
        self.exitcode = None
        self.__execution_count = 0
        self.__worker_id = uuid4().hex

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
        max_task_count = self.options.get("max_task_count", None)
        try:
            while True:
                self.process_tasks(self.namespace)
                if max_task_count is not None and max_task_count <= self.__execution_count:
                    self.exitcode = 1
                    raise WorkerComplete("Max task exeuction count reached")

        except KeyboardInterrupt:
            self.exitcode = 1
        except WorkerComplete as err:
            self.exitcode = 0
            logger.warning(str(err))
        except Exception:
            logger.exception("Worker process crashed")

    def process_tasks(self, namespace: TaskNamespace) -> None:
        from sentry.taskworker.service.client import task_client

        try:
            activation = task_client.get_task(topic=namespace.topic)
        except grpc.RpcError:
            logger.info("get_task failed. Retrying in 1 second")
            time.sleep(1)
            return

        if not activation:
            logger.info("No tasks")
            time.sleep(1)
            return

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
        self.__execution_count += 1

        # Dump results to a log file that is CSV shaped
        result_logger.info(
            f"task.complete,{self.__worker_id},{task_added_time},{execution_time},{task_latency}"
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
