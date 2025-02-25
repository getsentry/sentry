from __future__ import annotations

import dataclasses
import logging
import multiprocessing
import queue
import signal
import sys
import time
from multiprocessing.context import ForkProcess
from multiprocessing.synchronize import Event
from types import FrameType
from typing import Any
from uuid import uuid4

import grpc
import orjson
import sentry_sdk
from django.conf import settings
from django.core.cache import cache
from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
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

mp_context = multiprocessing.get_context("fork")
logger = logging.getLogger("sentry.taskworker.worker")


@dataclasses.dataclass
class ProcessingResult:
    """Result structure from child processess to parent"""

    task_id: str
    status: TaskActivationStatus.ValueType


AT_MOST_ONCE_TIMEOUT = 60 * 60 * 24  # 1 day


def get_at_most_once_key(namespace: str, taskname: str, task_id: str) -> str:
    # tw:amo -> taskworker:at_most_once
    return f"tw:amo:{namespace}:{taskname}:{task_id}"


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
    child_tasks: queue.Queue[TaskActivation],
    processed_tasks: queue.Queue[ProcessingResult],
    shutdown_event: Event,
    max_task_count: int | None,
) -> None:
    for module in settings.TASKWORKER_IMPORTS:
        __import__(module)

    current_task_id: str | None = None
    processed_task_count = 0

    def handle_alarm(signum: int, frame: Any) -> None:
        """
        Handle SIGALRM

        If we hit an alarm in a child, we need to push a result
        and terminate the child.
        """
        nonlocal current_task_id, processed_tasks

        if current_task_id:
            processed_tasks.put(
                ProcessingResult(task_id=current_task_id, status=TASK_ACTIVATION_STATUS_FAILURE)
            )
        metrics.incr("taskworker.worker.processing_deadline_exceeded")
        sys.exit(1)

    signal.signal(signal.SIGALRM, handle_alarm)

    while True:
        if max_task_count and processed_task_count >= max_task_count:
            metrics.incr(
                "taskworker.worker.max_task_count_reached",
                tags={"count": processed_task_count},
            )
            logger.info("taskworker.max_task_count_reached", extra={"count": processed_task_count})
            break

        if shutdown_event.is_set():
            logger.info("taskworker.worker.shutdown_event")
            break

        try:
            activation = child_tasks.get(timeout=0.1)
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
                continue

        current_task_id = activation.id

        # Set an alarm for the processing_deadline_duration
        signal.alarm(activation.processing_deadline_duration)

        execution_start_time = time.time()
        next_state = TASK_ACTIVATION_STATUS_FAILURE
        try:
            _execute_activation(task_func, activation)
            next_state = TASK_ACTIVATION_STATUS_COMPLETE
            # Clear the alarm
            signal.alarm(0)
        except Exception as err:
            if task_func.should_retry(activation.retry_state, err):
                logger.info("taskworker.task.retry", extra={"task": activation.taskname})
                next_state = TASK_ACTIVATION_STATUS_RETRY

            if next_state != TASK_ACTIVATION_STATUS_RETRY:
                logger.info(
                    "taskworker.task.errored", extra={"type": str(err.__class__), "error": str(err)}
                )

        processed_task_count += 1

        # Get completion time before pushing to queue to avoid inflating latency metrics.
        execution_complete_time = time.time()
        processed_tasks.put(ProcessingResult(task_id=activation.id, status=next_state))

        task_added_time = activation.received_at.ToDatetime().timestamp()
        execution_duration = execution_complete_time - execution_start_time
        execution_latency = execution_complete_time - task_added_time
        logger.debug(
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


def _execute_activation(task_func: Task[Any, Any], activation: TaskActivation) -> None:
    """Invoke a task function with the activation parameters."""
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
        num_brokers: int | None,
        max_task_count: int | None = None,
        namespace: str | None = None,
        concurrency: int = 1,
        prefetch_multiplier: float = 1.0,
        **options: dict[str, Any],
    ) -> None:
        self.options = options
        self._execution_count = 0
        self._worker_id = uuid4().hex
        self._max_task_count = max_task_count
        self._namespace = namespace
        self._concurrency = concurrency
        self.client = TaskworkerClient(rpc_host, num_brokers)
        queuesize = int(concurrency * prefetch_multiplier)
        self._child_tasks: multiprocessing.Queue[TaskActivation] = mp_context.Queue(
            maxsize=queuesize
        )
        self._processed_tasks: multiprocessing.Queue[ProcessingResult] = mp_context.Queue(
            maxsize=queuesize
        )
        self._children: list[ForkProcess] = []
        self._shutdown_event = mp_context.Event()
        self.backoff_sleep_seconds = 0

    def __del__(self) -> None:
        self._shutdown()

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
        self._spawn_children()

        signal.signal(signal.SIGINT, self._handle_sigint)

        while True:
            work_remaining = self.run_once()
            if work_remaining:
                self.backoff_sleep_seconds = 0
            else:
                self.backoff_sleep_seconds = min(self.backoff_sleep_seconds + 1, 10)
                time.sleep(self.backoff_sleep_seconds)

    def run_once(self) -> bool:
        """Access point for tests to run a single worker loop"""
        task_added = self._add_task()
        results_drained = self._drain_result()
        self._spawn_children()
        return task_added or results_drained

    def _handle_sigint(self, signum: int, frame: FrameType | None) -> None:
        logger.info("taskworker.worker.sigint_received")
        self._shutdown()
        raise KeyboardInterrupt("Shutdown complete")

    def _shutdown(self) -> None:
        """
        Shutdown cleanly
        Activate the shutdown event and drain results before terminating children.
        """
        self._shutdown_event.set()

        while True:
            more = self._drain_result(fetch=False)
            if not more:
                break
        for child in self._children:
            child.terminate()
            child.join()

    def _add_task(self) -> bool:
        """
        Add a task to child tasks queue. Returns False if no new task was fetched.
        """
        if self._child_tasks.full():
            return False

        task = self.fetch_task()
        if task:
            try:
                self._child_tasks.put(task, timeout=0.1)
            except queue.Full:
                logger.warning(
                    "taskworker.add_task.child_task_queue_full", extra={"task_id": task.id}
                )
            return True
        else:
            return False

    def _drain_result(self, fetch: bool = True) -> bool:
        """
        Consume results from children and update taskbroker. Returns True if there are more tasks to process.
        """
        try:
            result = self._processed_tasks.get_nowait()
        except queue.Empty:
            return False

        if fetch:
            fetch_next = None
            if not self._child_tasks.full():
                fetch_next = FetchNextTask(namespace=self._namespace)

            try:
                next_task = self.client.update_task(
                    task_id=result.task_id,
                    status=result.status,
                    fetch_next_task=fetch_next,
                )
            except grpc.RpcError as e:
                logger.exception(
                    "taskworker.drain_result.update_task_failed",
                    extra={"task_id": result.task_id, "error": e},
                )
                return True

            if next_task:
                try:
                    self._child_tasks.put(next_task, block=False)
                except queue.Full:
                    logger.warning(
                        "taskworker.drain_result.child_task_queue_full",
                        extra={"task_id": next_task.id},
                    )
            return True

        self.client.update_task(
            task_id=result.task_id,
            status=result.status,
        )
        return True

    def _spawn_children(self) -> None:
        active_children = [child for child in self._children if child.is_alive()]
        if len(active_children) >= self._concurrency:
            return
        for _ in range(self._concurrency - len(active_children)):
            process = mp_context.Process(
                target=child_worker,
                args=(
                    self._child_tasks,
                    self._processed_tasks,
                    self._shutdown_event,
                    self._max_task_count,
                ),
            )
            process.start()
            active_children.append(process)
            logger.info("taskworker.spawn_child", extra={"pid": process.pid})

        self._children = active_children

    def fetch_task(self) -> TaskActivation | None:
        try:
            activation = self.client.get_task(self._namespace)
        except grpc.RpcError as e:
            metrics.incr("taskworker.worker.fetch_task", tags={"status": "failed"})
            logger.info("taskworker.fetch_task.failed", extra={"error": e})
            return None

        if not activation:
            metrics.incr("taskworker.worker.fetch_task", tags={"status": "notfound"})
            logger.debug("taskworker.fetch_task.not_found")
            return None

        metrics.incr(
            "taskworker.worker.fetch_task",
            tags={"status": "success", "namespace": activation.namespace},
        )
        return activation
