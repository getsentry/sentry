from __future__ import annotations

import logging
import time
from multiprocessing.context import TimeoutError
from multiprocessing.pool import Pool
from typing import Any
from uuid import uuid4

import grpc
import orjson
from django.conf import settings
from sentry_protos.sentry.v1.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    TaskActivation,
)

from sentry.taskworker.registry import taskregistry
from sentry.taskworker.service.client import TaskClient

logger = logging.getLogger("sentry.taskworker.worker")


def _process_activation(namespace: str, task_name: str, args: Any, kwargs: Any) -> None:
    """multiprocess worker method"""
    taskregistry.get(namespace).get(task_name)(*args, **kwargs)


def _init_worker() -> None:
    """Initializer for multiprocess worker"""
    from sentry.runner import configure

    configure()

    for module in settings.TASKWORKER_IMPORTS:
        __import__(module)


class WorkerCompleteException(Exception):
    pass


class TaskWorker:
    """
    A TaskWorker fetches tasks from a task queue (inflight activation store) and handles executing them.
    As a tasks are executed, the worker will update the task status in the task queue.
    """

    def __init__(
        self, rpc_host: str, max_task_count: int | None = None, **options: dict[str, Any]
    ) -> None:
        self.options = options
        self.exitcode: int | None = None
        self._execution_count = 0
        self._worker_id = uuid4().hex
        self._max_task_count = max_task_count
        self.client = TaskClient(rpc_host)
        self._build_pool()

    def __del__(self) -> None:
        if self._pool:
            self._pool.terminate()

    def _build_pool(self) -> None:
        self._pool = Pool(processes=2, initializer=_init_worker)

    def do_imports(self) -> None:
        for module in settings.TASKWORKER_IMPORTS:
            __import__(module)
        self._build_pool()

    def start(self) -> None:
        self.do_imports()
        next_task: TaskActivation | None = None
        task: TaskActivation | None = None
        try:
            while True:
                if next_task:
                    task = next_task
                    next_task = None
                else:
                    task = self.fetch_task()

                if not task:
                    time.sleep(1)
                    continue

                next_task = self.process_task(task)
                if (
                    self._max_task_count is not None
                    and self._max_task_count <= self._execution_count
                ):
                    self.exitcode = 1
                    raise WorkerCompleteException("Max task exeuction count reached")

        except KeyboardInterrupt:
            self.exitcode = 1
        except WorkerCompleteException as err:
            self.exitcode = 0
            logger.warning(str(err))
        except Exception:
            logger.exception("Worker process crashed")

    def fetch_task(self) -> TaskActivation | None:
        try:
            activation = self.client.get_task()
        except grpc.RpcError:
            logger.info("get_task failed. Retrying in 1 second")
            return None

        if not activation:
            logger.info("No tasks")
            return None

        return activation

    def process_task(self, activation: TaskActivation) -> TaskActivation | None:
        assert self._pool

        namespace = taskregistry.get(activation.namespace)
        if not namespace.contains(activation.taskname):
            logger.error("Could not resolve task with name %s", activation.taskname)
            return None

        # TODO(taskworker): Add at_most_once checks.
        next_state = TASK_ACTIVATION_STATUS_FAILURE
        result = None
        execution_start_time = 0.0
        try:
            task_data_parameters = orjson.loads(activation.parameters)
            processing_timeout = activation.processing_deadline_duration
            execution_start_time = time.time()

            result = self._pool.apply_async(
                func=_process_activation,
                args=(
                    activation.namespace,
                    activation.taskname,
                    task_data_parameters["args"],
                    task_data_parameters["kwargs"],
                ),
            )
            # TODO(mark) Figure out why this is required to get successful results.
            time.sleep(5)

            # Will trigger a TimeoutError if the task execution runs long
            result.get(timeout=processing_timeout)

            next_state = TASK_ACTIVATION_STATUS_COMPLETE
        except TimeoutError:
            logger.info(
                "taskworker.task_execution_timeout", extra={"taskname": activation.taskname}
            )
            # When a task times out we kill the entire pool. This is necessary because
            # stdlib multiprocessing.Pool doesn't expose ways to terminate individual tasks.
            self._pool.terminate()
            self._build_pool()
        except Exception as err:
            # TODO(taskworker) handle explicit retries better.
            logger.info(
                "taskworker.task_errored", extra={"type": str(err.__class__), "error": str(err)}
            )
            # TODO(taskworker) check retry policy
            if namespace.get(activation.taskname).should_retry(activation.retry_state, err):
                logger.info("taskworker.task.retry", extra={"task": activation.taskname})
                next_state = TASK_ACTIVATION_STATUS_RETRY

        execution_complete_time = time.time()
        self._execution_count += 1

        task_added_time = activation.received_at.ToDatetime().timestamp()
        logger.info(
            "taskworker.task_execution",
            extra={
                "taskname": activation.taskname,
                "execution_time": execution_complete_time - execution_start_time,
                "execution_lag": execution_complete_time - task_added_time,
            },
        )

        if next_state == TASK_ACTIVATION_STATUS_COMPLETE:
            logger.info(
                "taskworker.task.complete", extra={"task": activation.taskname, "id": activation.id}
            )
            next_task = self.client.complete_task(task_id=activation.id)
        else:
            logger.info(
                "taskworker.task.change_status",
                extra={"task": activation.taskname, "state": next_state},
            )
            next_task = self.client.set_task_status(
                task_id=activation.id,
                task_status=next_state,
            )

        if next_task:
            return next_task
        return None
