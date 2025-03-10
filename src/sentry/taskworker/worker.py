from __future__ import annotations

import atexit
import dataclasses
import logging
import multiprocessing
import queue
import signal
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from multiprocessing.context import ForkProcess
from multiprocessing.synchronize import Event
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
            metrics.incr("taskworker.worker.child_task_queue_empty")
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
        metrics.distribution(
            "taskworker.worker.processed_tasks.put.duration",
            time.time() - execution_complete_time,
        )

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
        child_tasks_queue_maxsize: int = 1,
        result_queue_maxsize: int = 5,
        **options: dict[str, Any],
    ) -> None:
        self.options = options
        self._execution_count = 0
        self._worker_id = uuid4().hex
        self._max_task_count = max_task_count
        self._namespace = namespace
        self._concurrency = concurrency
        self.client = TaskworkerClient(rpc_host, num_brokers)
        self._child_tasks: multiprocessing.Queue[TaskActivation] = mp_context.Queue(
            maxsize=child_tasks_queue_maxsize
        )
        self._processed_tasks: multiprocessing.Queue[ProcessingResult] = mp_context.Queue(
            maxsize=result_queue_maxsize
        )
        self._children: list[ForkProcess] = []
        self._shutdown_event = mp_context.Event()
        self._task_receive_timing: dict[str, float] = {}
        self._result_thread: threading.Thread | None = None
        self.backoff_sleep_seconds = 0

    def __del__(self) -> None:
        self.shutdown()

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
        self.start_result_thread()
        self._spawn_children()

        atexit.register(self.shutdown)

        while True:
            self.run_once()

    def run_once(self) -> None:
        """Access point for tests to run a single worker loop"""
        self._add_task()
        self._spawn_children()

    def shutdown(self) -> None:
        """
        Shutdown cleanly
        Activate the shutdown event and drain results before terminating children.
        """
        if self._shutdown_event.is_set():
            return

        logger.info("taskworker.worker.shutdown")
        self._shutdown_event.set()

        for child in self._children:
            child.terminate()
            child.join()

        if self._result_thread:
            self._result_thread.join()

        # Drain remaining results synchronously, as the thread will have terminated
        # when shutdown_event was set.
        while True:
            try:
                result = self._processed_tasks.get_nowait()
                self._send_result(result, fetch=False)
            except queue.Empty:
                break

    def _add_task(self) -> bool:
        """
        Add a task to child tasks queue. Returns False if no new task was fetched.
        """
        if self._child_tasks.full():
            return False

        task = self.fetch_task()
        if task:
            try:
                start_time = time.time()
                self._child_tasks.put(task)
                metrics.distribution(
                    "taskworker.worker.child_task.put.duration", time.time() - start_time
                )
            except queue.Full:
                logger.warning(
                    "taskworker.add_task.child_task_queue_full", extra={"task_id": task.id}
                )
            return True
        else:
            return False

    def start_result_thread(self) -> None:
        """
        Start a thread that delivers results and fetches new tasks.
        We need to ship results in a thread because the RPC calls block for 20-50ms,
        and many tasks execute more quickly than that.

        Without additional threads, we end up publishing results too slowly
        and tasks accumulate in the `processed_tasks` queues and can cross
        their processing deadline.
        """

        def result_thread() -> None:
            logger.debug("taskworker.worker.result_thread_started")
            iopool = ThreadPoolExecutor(max_workers=self._concurrency)
            with iopool as executor:
                while not self._shutdown_event.is_set():
                    try:
                        result = self._processed_tasks.get(timeout=0.1)
                    except queue.Empty:
                        continue
                    executor.submit(self._send_result, result)

        self._result_thread = threading.Thread(target=result_thread)
        self._result_thread.start()

    def _send_result(self, result: ProcessingResult, fetch: bool = True) -> bool:
        """
        Send a result to the broker and conditionally fetch an additional task

        Run in a thread to avoid blocking the process, and during shutdown/
        See `start_result_thread`
        """
        task_received = self._task_receive_timing.pop(result.task_id, None)
        if task_received is not None:
            metrics.distribution("taskworker.worker.complete_duration", time.time() - task_received)

        if fetch:
            fetch_next = None
            if not self._child_tasks.full():
                fetch_next = FetchNextTask(namespace=self._namespace)

            metrics.incr("taskworker.worker.fetch_next", tags={"next": fetch_next is not None})
            logger.debug(
                "taskworker.workers._send_result",
                extra={"task_id": result.task_id, "next": fetch_next is not None},
            )
            next_task = self._send_update_task(result, fetch_next)
            if next_task:
                self._task_receive_timing[next_task.id] = time.time()
                try:
                    self._child_tasks.put(next_task)
                except queue.Full:
                    logger.warning(
                        "taskworker.send_result.child_task_queue_full",
                        extra={"task_id": next_task.id},
                    )
            return True

        self._send_update_task(result, fetch_next=None)
        return True

    def _send_update_task(
        self, result: ProcessingResult, fetch_next: FetchNextTask | None
    ) -> TaskActivation | None:
        """
        Do the RPC call to this worker's taskbroker, and handle errors
        """
        try:
            next_task = self.client.update_task(
                task_id=result.task_id,
                status=result.status,
                fetch_next_task=fetch_next,
            )
            return next_task
        except grpc.RpcError as e:
            if e.code() == grpc.StatusCode.UNAVAILABLE:
                self._processed_tasks.put(result)
            logger.exception(
                "taskworker.send_update_task.failed",
                extra={"task_id": result.task_id, "error": e},
            )
            return None

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

            self.backoff_sleep_seconds = min(self.backoff_sleep_seconds + 1, 10)
            time.sleep(self.backoff_sleep_seconds)
            return None

        metrics.incr(
            "taskworker.worker.fetch_task",
            tags={"status": "success", "namespace": activation.namespace},
        )
        self.backoff_sleep_seconds = 0
        self._task_receive_timing[activation.id] = time.time()
        return activation
