from __future__ import annotations

import dataclasses
import logging
import multiprocessing
import queue
import signal
import sys
import time
from multiprocessing.connection import Connection
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
class WaitResult:
    """Result structure that indicates a child is waiting for a task"""

    channel: Connection


@dataclasses.dataclass
class ProcessingResult(WaitResult):
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
    wait_queue: queue.Queue[WaitResult | ProcessingResult],
    shutdown_event: Event,
    max_task_count: int | None,
) -> None:
    for module in settings.TASKWORKER_IMPORTS:
        __import__(module)

    current_task_id: str | None = None
    processed_task_count = 0
    # send_conn is given back to the parent, and it will be used to send the
    # next activation. The worker waits for those activations on recv_conn.
    recv_conn, send_conn = multiprocessing.Pipe()

    def handle_alarm(signum: int, frame: Any) -> None:
        """
        Handle SIGALRM

        If we hit an alarm in a child, we need to push a result
        and terminate the child.
        """
        nonlocal current_task_id, wait_queue

        if current_task_id:
            wait_queue.put(
                ProcessingResult(
                    task_id=current_task_id,
                    status=TASK_ACTIVATION_STATUS_FAILURE,
                    channel=send_conn,
                )
            )
        metrics.incr("taskworker.worker.processing_deadline_exceeded")
        sys.exit(1)

    signal.signal(signal.SIGALRM, handle_alarm)

    # Put initial result on the queue
    wait_queue.put(WaitResult(channel=send_conn))

    def send_result(task_id: str, status: TaskActivationStatus.ValueType) -> None:
        wait_queue.put(ProcessingResult(task_id=task_id, status=status, channel=send_conn))

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

        if recv_conn.poll(timeout=0.1):
            activation = recv_conn.recv()
        else:
            metrics.incr("taskworker.worker.child_task_queue_empty")
            continue

        task_func = _get_known_task(activation)
        if not task_func:
            metrics.incr(
                "taskworker.worker.unknown_task",
                tags={"namespace": activation.namespace, "taskname": activation.taskname},
            )
            send_result(activation.id, TASK_ACTIVATION_STATUS_FAILURE)
            continue

        if task_func.at_most_once:
            key = get_at_most_once_key(activation.namespace, activation.taskname, activation.id)
            if cache.add(key, "1", timeout=AT_MOST_ONCE_TIMEOUT):  # The key didn't exist
                metrics.incr(
                    "taskworker.task.at_most_once.executed",
                    tags={"namespace": activation.namespace, "taskname": activation.taskname},
                )
            else:
                metrics.incr(
                    "taskworker.worker.at_most_once.skipped",
                    tags={"namespace": activation.namespace, "taskname": activation.taskname},
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
        send_result(activation.id, next_state)

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
                "taskname": activation.taskname,
                "namespace": activation.namespace,
                "status": next_state,
            },
        )
        metrics.distribution(
            "taskworker.worker.execution_duration",
            execution_duration,
            tags={"namespace": activation.namespace, "taskname": activation.taskname},
        )
        metrics.distribution(
            "taskworker.worker.execution_latency",
            execution_latency,
            tags={"namespace": activation.namespace, "taskname": activation.taskname},
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
        **options: dict[str, Any],
    ) -> None:
        self.options = options
        self._execution_count = 0
        self._worker_id = uuid4().hex
        self._max_task_count = max_task_count
        self._namespace = namespace
        self._tags = {"namespace": namespace}
        self._concurrency = concurrency
        self.client = TaskworkerClient(rpc_host, num_brokers)
        # self._child_tasks: multiprocessing.Queue[TaskActivation] = mp_context.Queue(maxsize=1)
        self._waiting_results: multiprocessing.Queue[WaitResult] = mp_context.Queue(
            maxsize=concurrency
        )
        self._children: list[ForkProcess] = []
        self._shutdown_event = mp_context.Event()
        self._task_receive_timing: dict[str, float] = {}
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
            values = self.run_once()
            if values is None:
                metrics.incr("taskworker.worker.no_results", tags=self._tags)
                continue

            fetched_tasks, idle_workers = values
            if fetched_tasks == 0 and idle_workers == self._concurrency:
                metrics.incr("taskworker.worker.no_work", tags=self._tags)
                time.sleep(self.backoff_sleep_seconds)
                self.backoff_sleep_seconds = min(self.backoff_sleep_seconds + 1, 10)
            else:
                self.backoff_sleep_seconds = 0

    def run_once(self) -> tuple[int, int] | None:
        """Access point for tests to run a single worker loop"""
        results_drained = self.drain_queue()
        metrics.distribution(
            "taskworker.worker.results_drained", len(results_drained), tags=self._tags
        )
        results = self.update_results(results_drained)
        if results is None:
            # There were no results in the queue. Wait for the next loop.
            return None

        next_tasks, num_tasks_to_fetch = results

        if num_tasks_to_fetch:
            metrics.distribution(
                "taskworker.worker.requested_extra_tasks", num_tasks_to_fetch, tags=self._tags
            )
            get_tasks = self.fetch_tasks(num_tasks_to_fetch)
            next_tasks.extend(get_tasks)

        work_remaining = len(next_tasks)
        metrics.distribution(
            "taskworker.worker.idle_workers",
            len(results_drained) - len(next_tasks),
            tags=self._tags,
        )
        idle_workers = 0
        for result in results_drained:
            if len(next_tasks) == 0:
                # Enqueue for the next pass
                self._waiting_results.put(WaitResult(channel=result.channel))
                idle_workers += 1
                continue

            next_task = next_tasks.pop(0)
            result.channel.send(next_task)

        return work_remaining, idle_workers

    def drain_queue(self) -> list[WaitResult | ProcessingResult]:
        """
        Drain the queue of all the results and return them for processing.
        """
        results = []
        try:
            results.append(self._waiting_results.get_nowait())
        except queue.Empty:
            return results
        return results

    def update_results(
        self, results: list[WaitResult | ProcessingResult], fetch_next: bool = True
    ) -> tuple[list[TaskActivation], int] | None:
        # If there are no results, and no tasks were fetched, then there is no work to do at the moment.
        if len(results) == 0:
            metrics.incr("taskworker.worker.no_results")
            return None

        tasks_to_fetch = len(results)

        processing_results = [r for r in results if isinstance(r, ProcessingResult)]
        next_tasks = self.send_task_results(processing_results, fetch_next)

        return next_tasks, tasks_to_fetch - len(next_tasks)

    def send_task_results(
        self, results: list[ProcessingResult], should_fetch_next: bool = True
    ) -> list[TaskActivation]:
        """
        Send the results of task activations to the taskbroker.
        """
        next_tasks = []
        for result in results:
            fetch_next = None
            if should_fetch_next:
                fetch_next = FetchNextTask(namespace=self._namespace)
                metrics.incr("taskworker.worker.fetch_next", tags=self._tags)

            # TODO: This could be done in a batch
            next_task = self.client.update_task(
                task_id=result.task_id,
                status=result.status,
                fetch_next_task=fetch_next,
            )
            if next_task:
                next_tasks.append(next_task)

            # Update timing metric
            task_received = self._task_receive_timing.pop(result.task_id, None)
            if task_received is not None:
                metrics.distribution(
                    "taskworker.worker.complete_duration", time.time() - task_received
                )
            if next_task:
                self._task_receive_timing[next_task.id] = time.time()

        return next_tasks

    def fetch_tasks(self, num_tasks: int) -> list[TaskActivation]:
        tasks: list[TaskActivation] = []
        # TODO: Do this in a batch
        for _ in range(num_tasks):
            try:
                activation = self.client.get_task(self._namespace)
            except grpc.RpcError as e:
                metrics.incr(
                    "taskworker.worker.fetch_task", tags={**self._tags, "status": "failed"}
                )
                logger.info("taskworker.fetch_task.failed", extra={"error": e})
                return tasks

            if not activation:
                metrics.incr(
                    "taskworker.worker.fetch_task", tags={**self._tags, "status": "notfound"}
                )
                logger.debug("taskworker.fetch_task.not_found")
                return tasks

            tasks.append(activation)

            metrics.incr(
                "taskworker.worker.fetch_task",
                tags={**self._tags, "status": "success"},
            )
            self._task_receive_timing[activation.id] = time.time()

        return tasks

    def _spawn_children(self) -> None:
        active_children = [child for child in self._children if child.is_alive()]
        if len(active_children) >= self._concurrency:
            return
        for _ in range(self._concurrency - len(active_children)):
            process = mp_context.Process(
                target=child_worker,
                args=(
                    self._waiting_results,
                    self._shutdown_event,
                    self._max_task_count,
                ),
            )
            process.start()
            active_children.append(process)
            logger.info("taskworker.spawn_child", extra={"pid": process.pid})

        self._children = active_children

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

        results = self.drain_queue()
        self.update_results(results, fetch_next=False)

        for child in self._children:
            child.terminate()
            child.join()
