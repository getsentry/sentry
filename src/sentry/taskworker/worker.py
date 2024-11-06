from __future__ import annotations

import logging
import multiprocessing
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

# Use forking processes so that django is initialized
mp_context = multiprocessing.get_context("fork")


def _process_activation(
    namespace: str, task_name: str, args: list[Any], kwargs: dict[str, Any]
) -> None:
    """multiprocess worker method"""
    taskregistry.get(namespace).get(task_name)(*args, **kwargs)


class TaskWorker:
    """
    A TaskWorker fetches tasks from a taskworker RPC host and handles executing task activations.

    Tasks are executed in a forked process so that processing timeouts can be enforced.
    As tasks are completed status changes will be sent back to the RPC host and new tasks
    will be fetched.

    Taskworkers can be run with `sentry run taskworker`
    """

    def __init__(
        self, rpc_host: str, max_task_count: int | None = None, **options: dict[str, Any]
    ) -> None:
        self.options = options
        self._execution_count = 0
        self._worker_id = uuid4().hex
        self._max_task_count = max_task_count
        self.client = TaskClient(rpc_host)
        self._pool: Pool | None = None
        self._build_pool()

    def __del__(self) -> None:
        if self._pool:
            self._pool.terminate()

    def _build_pool(self) -> None:
        if self._pool:
            self._pool.terminate()
        self._pool = mp_context.Pool(processes=1)

    def do_imports(self) -> None:
        for module in settings.TASKWORKER_IMPORTS:
            __import__(module)
        self._build_pool()

    def start(self) -> int:
        """
        Run the worker main loop

        Once started a Worker will loop until it is killed, or
        completes its max_task_count when it shuts down.
        """
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
                    logger.info("Max task execution count reached. Terminating")
                    return 0

        except KeyboardInterrupt:
            return 1
        except Exception:
            logger.exception("Worker process crashed")
            return 2

    def fetch_task(self) -> TaskActivation | None:
        try:
            activation = self.client.get_task()
        except grpc.RpcError:
            logger.info("get_task failed. Retrying in 1 second")
            return None

        if not activation:
            logger.info("No task fetched")
            return None

        return activation

    def _known_task(self, activation: TaskActivation) -> bool:
        if not taskregistry.contains(activation.namespace):
            logger.error(
                "taskworker.invalid_namespace",
                extra={"namespace": activation.namespace, "taskname": activation.taskname},
            )
            return False

        namespace = taskregistry.get(activation.namespace)
        if not namespace.contains(activation.taskname):
            logger.error(
                "taskworker.invalid_taskname",
                extra={"namespace": activation.namespace, "taskname": activation.taskname},
            )
            return False
        return True

    def process_task(self, activation: TaskActivation) -> TaskActivation | None:
        assert self._pool
        if not self._known_task(activation):
            self._execution_count += 1
            return self.client.update_task(
                task_id=activation.id,
                status=TASK_ACTIVATION_STATUS_FAILURE,
            )

        # TODO(taskworker): Add at_most_once checks
        processing_timeout = activation.processing_deadline_duration
        namespace = taskregistry.get(activation.namespace)
        next_state = TASK_ACTIVATION_STATUS_FAILURE
        result = None
        execution_start_time = 0.0
        try:
            task_data_parameters = orjson.loads(activation.parameters)
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
            # Will trigger a TimeoutError if the task execution runs long
            result.get(timeout=processing_timeout)

            next_state = TASK_ACTIVATION_STATUS_COMPLETE
        except TimeoutError:
            logger.info(
                "taskworker.task_execution_timeout",
                extra={
                    "taskname": activation.taskname,
                    "processing_deadline": processing_timeout,
                },
            )
            # When a task times out we kill the entire pool. This is necessary because
            # stdlib multiprocessing.Pool doesn't expose ways to terminate individual tasks.
            self._build_pool()
        except Exception as err:
            if namespace.get(activation.taskname).should_retry(activation.retry_state, err):
                logger.info("taskworker.task.retry", extra={"task": activation.taskname})
                next_state = TASK_ACTIVATION_STATUS_RETRY

            if next_state != TASK_ACTIVATION_STATUS_RETRY:
                logger.info(
                    "taskworker.task_errored", extra={"type": str(err.__class__), "error": str(err)}
                )

        execution_complete_time = time.time()
        self._execution_count += 1

        task_added_time = activation.received_at.ToDatetime().timestamp()
        logger.info(
            "taskworker.task_execution",
            extra={
                "taskname": activation.taskname,
                "execution_duration": execution_complete_time - execution_start_time,
                "execution_latency": execution_complete_time - task_added_time,
                "status": next_state,
            },
        )
        return self.client.update_task(
            task_id=activation.id,
            status=next_state,
        )
