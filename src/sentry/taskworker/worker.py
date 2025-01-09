from __future__ import annotations

import dataclasses
import logging
import multiprocessing
import queue
import signal
import time
from multiprocessing.context import TimeoutError
from multiprocessing.pool import Pool
from typing import Any
from uuid import uuid4

import grpc
import orjson
import sentry_sdk
from django.conf import settings
from django.core.cache import cache
from sentry_protos.sentry.v1.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    FetchNextTask,
    TaskActivation,
    TaskActivationStatus,
)

from sentry.taskworker.client import TaskworkerClient
from sentry.taskworker.registry import taskregistry
from sentry.taskworker.task import Task
from sentry.utils import metrics
from sentry.utils.memory import track_memory_usage

logger = logging.getLogger("sentry.taskworker.worker")

mp_context = multiprocessing.get_context("spawn")


def _execute_activation(task_func: Task[Any, Any], activation: TaskActivation) -> None:
    """multiprocess worker method"""
    parameters = orjson.loads(activation.parameters)
    args = parameters.get("args", [])
    kwargs = parameters.get("kwargs", {})
    headers = {k: v for k, v in activation.headers.items()}

    transaction = sentry_sdk.continue_trace(
        environ_or_headers=headers,
        op="task.taskworker",
        name=f"{activation.namespace}:{activation.taskname}",
    )
    with (
        track_memory_usage("taskworker.worker.memory_change"),
        sentry_sdk.start_transaction(transaction),
    ):
        task_func(*args, **kwargs)


def _get_known_task(activation: TaskActivation) -> Task[Any, Any] | None:
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


def child_worker(
    child_tasks: multiprocessing.Queue[TaskActivation],
    processed_tasks: multiprocessing.Queue[ProcessingResult],
) -> None:
    # TODO execution count
    for module in settings.TASKWORKER_IMPORTS:
        __import__(module)

    current_task_id = None

    def handle_alarm(signum: int, frame: Any) -> None:
        """
        Handle SIGALRM

        If we hit an alarm in a child, we need to push a result
        and terminate the child.
        """
        if current_task_id:
            processed_tasks.put(
                ProcessingResult(task_id=current_task_id, status=TASK_ACTIVATION_STATUS_FAILURE)
            )
        raise TimeoutError("Task proessing_deadline_duration exceeded")

    signal.signal(signal.SIGALRM, handle_alarm)

    while True:
        try:
            activation = child_tasks.get(timeout=1)
        except queue.Empty:
            continue
        task_func = _get_known_task(activation)
        if not task_func:
            metrics.incr(
                "taskworker.worker.unknown_task",
                tags={"namespace": activation.namespace, "taskname": activation.taskname},
            )
            processed_tasks.put(
                ProcessingResult(task_id=activation.id, status=TASK_ACTIVATION_STATUS_FAILURE)
            )
            continue

        if task_func.at_most_once:
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

        current_task_id = activation.id

        # Set an alarm for the processing_deadline_duration
        signal.alarm(activation.processing_deadline_duration)

        next_state = TASK_ACTIVATION_STATUS_COMPLETE
        execution_start_time = time.monotonic()
        try:
            _execute_activation(task_func, activation)
        except Exception as err:
            if task_func.should_retry(activation.retry_state, err):
                logger.info("taskworker.task.retry", extra={"task": activation.taskname})
                next_state = TASK_ACTIVATION_STATUS_RETRY

            if next_state != TASK_ACTIVATION_STATUS_RETRY:
                logger.info(
                    "taskworker.task_errored", extra={"type": str(err.__class__), "error": str(err)}
                )

        execution_complete_time = time.monotonic()

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

        processed_tasks.put(ProcessingResult(task_id=activation.id, status=next_state))


AT_MOST_ONCE_TIMEOUT = 60 * 60 * 24  # 1 day


@dataclasses.dataclass
class ProcessingResult:
    """Result structure from child processess to parent"""

    task_id: str
    status: TaskActivationStatus.ValueType


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
        self,
        rpc_host: str,
        max_task_count: int | None = None,
        namespace: str | None = None,
        concurrency: int = 1,
        **options: dict[str, Any],
    ) -> None:
        self.options = options
        self._execution_count = 0
        self._worker_id = uuid4().hex
        self._max_task_count = max_task_count
        self._namespace = namespace
        self._concurrency = concurrency
        self.client = TaskworkerClient(rpc_host)
        self._child_tasks: multiprocessing.Queue[TaskActivation] = multiprocessing.Queue(
            maxsize=(concurrency * 10)
        )
        self._processed_tasks: multiprocessing.Queue[ProcessingResult] = multiprocessing.Queue(
            maxsize=(concurrency * 10)
        )
        self._children: list[multiprocessing.Process] = []

    def __del__(self) -> None:
        # todo set shutdown signal
        for child in self._children:
            child.terminate()

    def do_imports(self) -> None:
        for module in settings.TASKWORKER_IMPORTS:
            __import__(module)

    def start(self) -> int:
        """
        Run the worker main loop

        Once started a Worker will loop until it is killed, or
        completes its max_task_count when it shuts down.
        """
        self.do_imports()

        # Start child processes
        self._spawn_children()

        # Main loop for the parent process
        # 1. If child_tasks has room, fetch a task and add it to the child_tasks queue
        # 2. fetch from processed_tasks and ship a result
        # 3. Check that there are enough processes alive still.
        try:
            while True:
                self._add_task()
                self._drain_result()
                self._spawn_children()
        except KeyboardInterrupt:
            # TODO need to expand this more to shutdown clean.
            # - set shutdown signal for children
            # - drain results and flush
            return 1
        except Exception:
            logger.exception("Worker process crashed")
            return 2

    def _add_task(self) -> None:
        try:
            task = self.fetch_task()
            if task:
                self._child_tasks.put(task, block=False)
        except queue.Full:
            logging.error("Child task queue is full")

    def _drain_result(self) -> None:
        try:
            result = self._processed_tasks.get_nowait()
        except queue.Empty:
            return

        next_task = self.client.update_task(
            task_id=result.task_id,
            status=result.status,
            fetch_next_task=FetchNextTask(namespace=self._namespace),
        )
        if next_task:
            try:
                self._child_tasks.put(next_task, block=False)
            except queue.Full:
                logging.error("Child task queue is full")

    def _spawn_children(self) -> None:
        active_children = [child.is_alive() for child in self._children]
        if len(active_children) >= self._concurrency:
            return
        for _ in range(self._concurrency - len(active_children)):
            self._children.append(
                multiprocessing.Process(
                    target=child_worker,
                    args=(self._child_tasks, self._processed_tasks),
                    daemon=True,
                )
            )

    def _drain_processed_tasks(self) -> None:
        """Remove tasks from the processed result queue and complete RPC calls"""
        try:
            result = self._processed_tasks.get_nowait()
        except queue.Empty:
            return

        return self.client.update_task(
            task_id=result.task_id,
            status=result.status,
            fetch_next_task=FetchNextTask(namespace=self._namespace),
        )

    def fetch_task(self) -> TaskActivation | None:
        try:
            activation = self.client.get_task(self._namespace)
        except grpc.RpcError:
            metrics.incr("taskworker.worker.get_task.failed")
            logger.info("get_task failed. Retrying in 1 second")
            return None

        if not activation:
            metrics.incr("taskworker.worker.get_task.not_found")
            logger.debug("No task fetched")
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
                fetch_next_task=FetchNextTask(namespace=self._namespace),
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
            execution_start_time = time.time()

            result = self._pool.apply_async(
                func=_process_activation,
                args=(activation,),
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
            fetch_next_task=FetchNextTask(namespace=self._namespace),
        )
