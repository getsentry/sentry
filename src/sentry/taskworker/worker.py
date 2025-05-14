from __future__ import annotations

import atexit
import logging
import multiprocessing
import queue
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from multiprocessing.context import ForkContext, SpawnContext
from multiprocessing.process import BaseProcess
from typing import Any

import grpc
from django.conf import settings
from sentry_protos.taskbroker.v1.taskbroker_pb2 import FetchNextTask, TaskActivation

from sentry.taskworker.client import TaskworkerClient
from sentry.taskworker.constants import DEFAULT_REBALANCE_AFTER, DEFAULT_WORKER_QUEUE_SIZE
from sentry.taskworker.workerchild import ProcessingResult, child_process
from sentry.utils import metrics

logger = logging.getLogger("sentry.taskworker.worker")


class TaskWorker:
    """
    A TaskWorker fetches tasks from a taskworker RPC host and handles executing task activations.

    Tasks are executed in a forked process so that processing timeouts can be enforced.
    As tasks are completed status changes will be sent back to the RPC host and new tasks
    will be fetched.

    Taskworkers can be run with `sentry run taskworker`
    """

    mp_context: ForkContext | SpawnContext

    def __init__(
        self,
        rpc_host: str,
        num_brokers: int | None,
        max_child_task_count: int | None = None,
        namespace: str | None = None,
        concurrency: int = 1,
        child_tasks_queue_maxsize: int = DEFAULT_WORKER_QUEUE_SIZE,
        result_queue_maxsize: int = DEFAULT_WORKER_QUEUE_SIZE,
        rebalance_after: int = DEFAULT_REBALANCE_AFTER,
        processing_pool_name: str | None = None,
        process_type: str = "spawn",
        **options: dict[str, Any],
    ) -> None:
        self.options = options
        self._max_child_task_count = max_child_task_count
        self._namespace = namespace
        self._concurrency = concurrency
        self.client = TaskworkerClient(rpc_host, num_brokers, rebalance_after)
        if process_type == "fork":
            self.mp_context = multiprocessing.get_context("fork")
        elif process_type == "spawn":
            self.mp_context = multiprocessing.get_context("spawn")
        else:
            raise ValueError(f"Invalid process type: {process_type}")
        self._process_type = process_type

        self._child_tasks: multiprocessing.Queue[TaskActivation] = self.mp_context.Queue(
            maxsize=child_tasks_queue_maxsize
        )
        self._processed_tasks: multiprocessing.Queue[ProcessingResult] = self.mp_context.Queue(
            maxsize=result_queue_maxsize
        )
        self._children: list[BaseProcess] = []
        self._shutdown_event = self.mp_context.Event()
        self._task_receive_timing: dict[str, float] = {}
        self._result_thread: threading.Thread | None = None
        self._spawn_children_thread: threading.Thread | None = None

        self._gettask_backoff_seconds = 0
        self._setstatus_backoff_seconds = 0

        self._processing_pool_name: str = processing_pool_name or "unknown"

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
        self.start_spawn_children_thread()

        atexit.register(self.shutdown)

        while True:
            self.run_once()

    def run_once(self) -> None:
        """Access point for tests to run a single worker loop"""
        self._add_task()

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

        if self._spawn_children_thread:
            self._spawn_children_thread.join()

    def _add_task(self) -> bool:
        """
        Add a task to child tasks queue. Returns False if no new task was fetched.
        """
        if self._child_tasks.full():
            return False

        task = self.fetch_task()
        if task:
            try:
                start_time = time.monotonic()
                self._child_tasks.put(task)
                metrics.distribution(
                    "taskworker.worker.child_task.put.duration",
                    time.monotonic() - start_time,
                    tags={"processing_pool": self._processing_pool_name},
                )
            except queue.Full:
                logger.warning(
                    "taskworker.add_task.child_task_queue_full",
                    extra={"task_id": task.id, "processing_pool": self._processing_pool_name},
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
                        result = self._processed_tasks.get(timeout=1.0)
                        executor.submit(self._send_result, result)
                    except queue.Empty:
                        metrics.incr(
                            "taskworker.worker.result_thread.queue_empty",
                            tags={"processing_pool": self._processing_pool_name},
                        )
                        continue

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
            metrics.distribution(
                "taskworker.worker.complete_duration",
                time.monotonic() - task_received,
                tags={"processing_pool": self._processing_pool_name},
            )

        if fetch:
            fetch_next = None
            if not self._child_tasks.full():
                fetch_next = FetchNextTask(namespace=self._namespace)

            next_task = self._send_update_task(result, fetch_next)
            if next_task:
                self._task_receive_timing[next_task.id] = time.monotonic()
                try:
                    self._child_tasks.put(next_task)
                except queue.Full:
                    logger.warning(
                        "taskworker.send_result.child_task_queue_full",
                        extra={
                            "task_id": next_task.id,
                            "processing_pool": self._processing_pool_name,
                        },
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
        logger.debug(
            "taskworker.workers._send_result",
            extra={
                "task_id": result.task_id,
                "next": fetch_next is not None,
                "processing_pool": self._processing_pool_name,
            },
        )
        # Use the shutdown_event as a sleep mechanism
        self._shutdown_event.wait(self._setstatus_backoff_seconds)
        try:
            next_task = self.client.update_task(
                task_id=result.task_id,
                status=result.status,
                fetch_next_task=fetch_next,
            )
            self._setstatus_backoff_seconds = 0
            return next_task
        except grpc.RpcError as e:
            self._setstatus_backoff_seconds = min(self._setstatus_backoff_seconds + 1, 10)
            if e.code() == grpc.StatusCode.UNAVAILABLE:
                self._processed_tasks.put(result)
            logger.exception(
                "taskworker.send_update_task.failed",
                extra={"task_id": result.task_id, "error": e},
            )
            return None

    def start_spawn_children_thread(self) -> None:
        def spawn_children_thread() -> None:
            logger.debug("taskworker.worker.spawn_children_thread_started")
            while not self._shutdown_event.is_set():
                self._children = [child for child in self._children if child.is_alive()]
                if len(self._children) >= self._concurrency:
                    time.sleep(0.1)
                    continue
                for i in range(self._concurrency - len(self._children)):
                    process = self.mp_context.Process(
                        target=child_process,
                        args=(
                            self._child_tasks,
                            self._processed_tasks,
                            self._shutdown_event,
                            self._max_child_task_count,
                            self._processing_pool_name,
                            self._process_type,
                        ),
                    )
                    process.start()
                    self._children.append(process)
                    logger.info(
                        "taskworker.spawn_child",
                        extra={"pid": process.pid, "processing_pool": self._processing_pool_name},
                    )

        self._spawn_children_thread = threading.Thread(target=spawn_children_thread)
        self._spawn_children_thread.start()

    def fetch_task(self) -> TaskActivation | None:
        # Use the shutdown_event as a sleep mechanism
        self._shutdown_event.wait(self._gettask_backoff_seconds)
        try:
            activation = self.client.get_task(self._namespace)
        except grpc.RpcError as e:
            logger.info(
                "taskworker.fetch_task.failed",
                extra={"error": e, "processing_pool": self._processing_pool_name},
            )

            self._gettask_backoff_seconds = min(self._gettask_backoff_seconds + 1, 10)
            return None

        if not activation:
            metrics.incr(
                "taskworker.worker.fetch_task.not_found",
                tags={"processing_pool": self._processing_pool_name},
            )
            logger.debug(
                "taskworker.fetch_task.not_found",
                extra={"processing_pool": self._processing_pool_name},
            )

            self._gettask_backoff_seconds = min(self._gettask_backoff_seconds + 1, 10)
            return None

        self._gettask_backoff_seconds = 0
        self._task_receive_timing[activation.id] = time.monotonic()
        return activation
