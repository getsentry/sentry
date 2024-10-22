from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from multiprocessing.context import TimeoutError
from multiprocessing.pool import Pool
from uuid import uuid4

import grpc
import orjson
from django.conf import settings
from django.utils import timezone
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    GetTaskResponse,
    TaskActivation,
)

from sentry.taskworker import worker_process
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

    def start(self) -> None:
        self.do_imports()
        max_task_count = self.options.get("max_task_count", None)
        next_task = None
        processing_deadline = None
        try:
            while True:
                if next_task:
                    task = next_task
                    next_task = None
                else:
                    (task, processing_deadline) = self.fetch_task()

                if not task:
                    time.sleep(1)
                    continue

                next_task, processing_deadline = self.process_task(task, processing_deadline)

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

    def fetch_task(self) -> tuple[TaskActivation | None, datetime | None]:
        from sentry.taskworker.service.client import task_client

        try:
            response: GetTaskResponse | None = task_client.get_task(topic=self.namespace.topic)
        except grpc.RpcError:
            logger.info("get_task failed. Retrying in 1 second")
            return (None, None)

        if not response:
            logger.info("No tasks")
            return (None, None)

        # TODO this default should come from namespace config
        deadline = timezone.now() + timedelta(seconds=30)
        if response.HasField("processing_deadline"):
            deadline = response.processing_deadline.ToDatetime()

        return (response.task, deadline)

    def process_task(
        self, activation: TaskActivation, processing_deadline: datetime
    ) -> tuple[TaskActivation | None, datetime | None]:
        from sentry.taskworker.service.client import task_client

        if not self.namespace.contains(activation.taskname):
            logger.exception("Could not resolve task with name %s", activation.taskname)
            return (None, None)

        # TODO: Check idempotency
        task_added_time = activation.received_at.seconds
        execution_time = time.time()
        next_state = TASK_ACTIVATION_STATUS_FAILURE
        result = None
        try:
            task_data_parameters = orjson.loads(activation.parameters)
            processing_timeout = (processing_deadline - datetime.now()).total_seconds()
            result = self.__pool.apply_async(
                func=worker_process._process_activation,
                args=(
                    self.options["namespace"],
                    activation.taskname,
                    task_data_parameters["args"],
                    task_data_parameters["kwargs"],
                ),
            )

            # Will trigger a TimeoutError if the task execution runs long
            result.get(timeout=processing_timeout)

            next_state = TASK_ACTIVATION_STATUS_COMPLETE
        except TimeoutError:
            logger.info("taskworker.task_execution_timeout")
            # When a task times out we kill the entire pool. This is necessary because
            # stdlib multiprocessing.Pool doesn't expose ways to terminate individual tasks.
            self.__pool.terminate()
            self._build_pool()
        except Exception as err:
            logger.info(
                "taskworker.task_errored", extra={"type": str(err.__class__), "error": str(err)}
            )
            # TODO check retry policy
            if self.namespace.get(activation.taskname).should_retry(activation.retry_state, err):
                logger.info("taskworker.task.retry", extra={"task": activation.taskname})
                next_state = TASK_ACTIVATION_STATUS_RETRY

        task_latency = execution_time - task_added_time
        self.__execution_count += 1

        if next_state == TASK_ACTIVATION_STATUS_COMPLETE:
            logger.info(
                "taskworker.task.complete", extra={"task": activation.taskname, "id": activation.id}
            )
            response = task_client.complete_task(task_id=activation.id)
        else:
            logger.info(
                "taskworker.task.change_status",
                extra={"task": activation.taskname, "state": next_state},
            )
            response = task_client.set_task_status(
                task_id=activation.id,
                task_status=next_state,
            )

        # Dump results to a log file that is CSV shaped
        result_logger.info(
            "task.complete, %s, %s, %s, %s, %s",
            self.__worker_id,
            task_added_time,
            execution_time,
            task_latency,
            activation.id,
        )

        if response.HasField("task") and response.HasField("processing_deadline"):
            new_task = response.task
            new_processing_deadline = response.processing_deadline.ToDatetime()
            return new_task, new_processing_deadline

        return None, None
