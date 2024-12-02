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
from django.core.cache import cache
from sentry_protos.sentry.v1.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    TaskActivation,
)

from sentry.taskworker.client import TaskworkerClient
from sentry.taskworker.registry import taskregistry
from sentry.taskworker.task import Task
from sentry.utils import metrics

logger = logging.getLogger("sentry.taskworker.worker")

# Use forking processes so that django is initialized
mp_context = multiprocessing.get_context("fork")


def _process_activation(
    namespace: str, task_name: str, args: list[Any], kwargs: dict[str, Any]
) -> None:
    """multiprocess worker method"""
    taskregistry.get(namespace).get(task_name)(*args, **kwargs)


AT_MOST_ONCE_TIMEOUT = 60 * 60 * 24  # 1 day


def get_at_most_once_key(namespace: str, taskname: str, task_id: str) -> str:
    # tw:amo -> taskworker:at_most_once
    return f"tw:amo:{namespace}:{taskname}:{task_id}"


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
        self.client = TaskworkerClient(rpc_host)
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
                    metrics.incr("taskworker.worker.no_task.pause")
                    time.sleep(1)
                    continue

                next_task = self.process_task(task)
                if (
                    self._max_task_count is not None
                    and self._max_task_count <= self._execution_count
                ):
                    metrics.incr(
                        "taskworker.worker.max_task_count_reached",
                        tags={"count": self._execution_count},
                    )
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
            metrics.incr("taskworker.worker.get_task.failed")
            logger.info("get_task failed. Retrying in 1 second")
            return None

        if not activation:
            metrics.incr("taskworker.worker.get_task.not_found")
            logger.info("No task fetched")
            return None

        metrics.incr("taskworker.worker.get_task.success")
        return activation

    def _get_known_task(self, activation: TaskActivation) -> Task[Any, Any] | None:
        if not taskregistry.contains(activation.namespace):
            logger.error(
                "taskworker.invalid_namespace",
                extra={"namespace": activation.namespace, "taskname": activation.taskname},
            )
            return None

        namespace = taskregistry.get(activation.namespace)
        if not namespace.contains(activation.taskname):
            logger.error(
                "taskworker.invalid_taskname",
                extra={"namespace": activation.namespace, "taskname": activation.taskname},
            )
            return None
        return namespace.get(activation.taskname)

    def process_task(self, activation: TaskActivation) -> TaskActivation | None:
        assert self._pool
        task = self._get_known_task(activation)
        if not task:
            metrics.incr(
                "taskworker.worker.unknown_task",
                tags={"namespace": activation.namespace, "taskname": activation.taskname},
            )
            self._execution_count += 1
            return self.client.update_task(
                task_id=activation.id,
                status=TASK_ACTIVATION_STATUS_FAILURE,
            )

        if task.at_most_once:
            key = get_at_most_once_key(activation.namespace, activation.taskname, activation.id)
            if cache.add(key, "1", timeout=AT_MOST_ONCE_TIMEOUT):  # The key didn't exist
                metrics.incr(
                    "taskworker.task.at_most_once.executed", tags={"task": activation.taskname}
                )
            else:
                metrics.incr(
                    "taskworker.worker.at_most_once.skipped", tags={"task": activation.taskname}
                )
                return None

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
        execution_duration = execution_complete_time - execution_start_time
        execution_latency = execution_complete_time - task_added_time
        logger.info(
            "taskworker.task_execution",
            extra={
                "taskname": activation.taskname,
                "execution_duration": execution_duration,
                "execution_latency": execution_latency,
                "status": next_state,
            },
        )
        metrics.incr(
            "taskworker.worker.execute_task",
            tags={
                "namespace": activation.namespace,
                "status": next_state,
            },
        )
        metrics.distribution(
            "taskworker.worker.execution_duration",
            execution_duration,
            tags={"namespace": activation.namespace},
        )
        metrics.distribution(
            "taskworker.worker.execution_latency",
            execution_latency,
            tags={"namespace": activation.namespace},
        )

        return self.client.update_task(
            task_id=activation.id,
            status=next_state,
        )
