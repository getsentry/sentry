from __future__ import annotations

import logging
import multiprocessing
import queue
import signal
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from multiprocessing.context import ForkContext, SpawnContext
from multiprocessing.process import BaseProcess
from pathlib import Path
from typing import Any

import grpc
from sentry_protos.taskbroker.v1.taskbroker_pb2 import FetchNextTask

from sentry import options
from sentry.taskworker.app import import_app
from sentry.taskworker.client.client import (
    HealthCheckSettings,
    HostTemporarilyUnavailable,
    TaskworkerClient,
)
from sentry.taskworker.client.inflight_task_activation import InflightTaskActivation
from sentry.taskworker.client.processing_result import ProcessingResult
from sentry.taskworker.constants import (
    DEFAULT_REBALANCE_AFTER,
    DEFAULT_WORKER_HEALTH_CHECK_SEC_PER_TOUCH,
    DEFAULT_WORKER_QUEUE_SIZE,
    MAX_BACKOFF_SECONDS_WHEN_HOST_UNAVAILABLE,
)
from sentry.taskworker.workerchild import child_process
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
        app_module: str,
        broker_hosts: list[str],
        max_child_task_count: int | None = None,
        namespace: str | None = None,
        concurrency: int = 1,
        child_tasks_queue_maxsize: int = DEFAULT_WORKER_QUEUE_SIZE,
        result_queue_maxsize: int = DEFAULT_WORKER_QUEUE_SIZE,
        rebalance_after: int = DEFAULT_REBALANCE_AFTER,
        processing_pool_name: str | None = None,
        process_type: str = "spawn",
        health_check_file_path: str | None = None,
        health_check_sec_per_touch: float = DEFAULT_WORKER_HEALTH_CHECK_SEC_PER_TOUCH,
        **kwargs: dict[str, Any],
    ) -> None:
        self.options = kwargs
        self._app_module = app_module
        self._max_child_task_count = max_child_task_count
        self._namespace = namespace
        self._concurrency = concurrency
        app = import_app(app_module)

        self.client = TaskworkerClient(
            hosts=broker_hosts,
            application=app.name,
            max_tasks_before_rebalance=rebalance_after,
            health_check_settings=(
                None
                if health_check_file_path is None
                else HealthCheckSettings(Path(health_check_file_path), health_check_sec_per_touch)
            ),
            rpc_secret=app.config["rpc_secret"],
            grpc_config=options.get("taskworker.grpc_service_config"),
        )
        if process_type == "fork":
            self.mp_context = multiprocessing.get_context("fork")
        elif process_type == "spawn":
            self.mp_context = multiprocessing.get_context("spawn")
        else:
            raise ValueError(f"Invalid process type: {process_type}")
        self._process_type = process_type

        self._child_tasks: multiprocessing.Queue[InflightTaskActivation] = self.mp_context.Queue(
            maxsize=child_tasks_queue_maxsize
        )
        self._processed_tasks: multiprocessing.Queue[ProcessingResult] = self.mp_context.Queue(
            maxsize=result_queue_maxsize
        )
        self._children: list[BaseProcess] = []
        self._shutdown_event = self.mp_context.Event()
        self._result_thread: threading.Thread | None = None
        self._spawn_children_thread: threading.Thread | None = None

        self._gettask_backoff_seconds = 0
        self._setstatus_backoff_seconds = 0

        self._processing_pool_name: str = processing_pool_name or "unknown"

    def start(self) -> int:
        """
        Run the worker main loop

        Once started a Worker will loop until it is killed, or
        completes its max_task_count when it shuts down.
        """
        self.start_result_thread()
        self.start_spawn_children_thread()

        # Convert signals into KeyboardInterrupt.
        # Running shutdown() within the signal handler can lead to deadlocks
        def signal_handler(*args: Any) -> None:
            raise KeyboardInterrupt()

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        try:
            while True:
                self.run_once()
        except KeyboardInterrupt:
            self.shutdown()
            raise

    def run_once(self) -> None:
        """Access point for tests to run a single worker loop"""
        self._add_task()

    def shutdown(self) -> None:
        """
        Shutdown cleanly
        Activate the shutdown event and drain results before terminating children.
        """
        logger.info("taskworker.worker.shutdown.start")
        self._shutdown_event.set()

        logger.info("taskworker.worker.shutdown.spawn_children")
        if self._spawn_children_thread:
            self._spawn_children_thread.join()

        logger.info("taskworker.worker.shutdown.children")
        for child in self._children:
            child.terminate()
        for child in self._children:
            child.join()

        logger.info("taskworker.worker.shutdown.result")
        if self._result_thread:
            # Use a timeout as sometimes this thread can deadlock on the Event.
            self._result_thread.join(timeout=5)

        # Drain any remaining results synchronously
        while True:
            try:
                result = self._processed_tasks.get_nowait()
                self._send_result(result, fetch=False)
            except queue.Empty:
                break

        logger.info("taskworker.worker.shutdown.complete")

    def _add_task(self) -> bool:
        """
        Add a task to child tasks queue. Returns False if no new task was fetched.
        """
        if self._child_tasks.full():
            # I want to see how this differs between pools that operate well,
            # and those that are not as effective. I suspect that with a consistent
            # load of slowish tasks (like 5-15 seconds) that this will happen
            # infrequently, resulting in the child tasks queue being full
            # causing processing deadline expiration.
            # Whereas in pools that have consistent short tasks, this happens
            # more frequently, allowing workers to run more smoothly.
            metrics.incr(
                "taskworker.worker.add_tasks.child_tasks_full",
                tags={"processing_pool": self._processing_pool_name},
            )
            # If we weren't able to add a task, backoff for a bit
            time.sleep(0.1)
            return False

        inflight = self.fetch_task()
        if inflight:
            try:
                start_time = time.monotonic()
                self._child_tasks.put(inflight)
                metrics.distribution(
                    "taskworker.worker.child_task.put.duration",
                    time.monotonic() - start_time,
                    tags={"processing_pool": self._processing_pool_name},
                )
            except queue.Full:
                metrics.incr(
                    "taskworker.worker.child_tasks.put.full",
                    tags={"processing_pool": self._processing_pool_name},
                )
                logger.warning(
                    "taskworker.add_task.child_task_queue_full",
                    extra={
                        "task_id": inflight.activation.id,
                        "processing_pool": self._processing_pool_name,
                    },
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
            logger.debug("taskworker.worker.result_thread.started")
            iopool = ThreadPoolExecutor(max_workers=self._concurrency)
            with iopool as executor:
                while not self._shutdown_event.is_set():
                    fetch_next = self._processing_pool_name not in options.get(
                        "taskworker.fetch_next.disabled_pools"
                    )

                    try:
                        result = self._processed_tasks.get(timeout=1.0)
                        executor.submit(self._send_result, result, fetch_next)
                    except queue.Empty:
                        metrics.incr(
                            "taskworker.worker.result_thread.queue_empty",
                            tags={"processing_pool": self._processing_pool_name},
                        )
                        continue

        self._result_thread = threading.Thread(
            name="send-result", target=result_thread, daemon=True
        )
        self._result_thread.start()

    def _send_result(self, result: ProcessingResult, fetch: bool = True) -> bool:
        """
        Send a result to the broker and conditionally fetch an additional task

        Run in a thread to avoid blocking the process, and during shutdown/
        See `start_result_thread`
        """
        metrics.distribution(
            "taskworker.worker.complete_duration",
            time.monotonic() - result.receive_timestamp,
            tags={"processing_pool": self._processing_pool_name},
        )

        if fetch:
            fetch_next = None
            if not self._child_tasks.full():
                fetch_next = FetchNextTask(namespace=self._namespace)

            next = self._send_update_task(result, fetch_next)
            if next:
                try:
                    start_time = time.monotonic()
                    self._child_tasks.put(next)
                    metrics.distribution(
                        "taskworker.worker.child_task.put.duration",
                        time.monotonic() - start_time,
                        tags={"processing_pool": self._processing_pool_name},
                    )
                except queue.Full:
                    logger.warning(
                        "taskworker.send_result.child_task_queue_full",
                        extra={
                            "task_id": next.activation.id,
                            "processing_pool": self._processing_pool_name,
                        },
                    )
            return True

        self._send_update_task(result, fetch_next=None)
        return True

    def _send_update_task(
        self, result: ProcessingResult, fetch_next: FetchNextTask | None
    ) -> InflightTaskActivation | None:
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
            next_task = self.client.update_task(result, fetch_next)
            self._setstatus_backoff_seconds = 0
            return next_task
        except grpc.RpcError as e:
            self._setstatus_backoff_seconds = min(self._setstatus_backoff_seconds + 1, 10)
            if e.code() == grpc.StatusCode.UNAVAILABLE:
                self._processed_tasks.put(result)
            logger.warning(
                "taskworker.send_update_task.failed",
                extra={"task_id": result.task_id, "error": e},
            )
            return None
        except HostTemporarilyUnavailable as e:
            self._setstatus_backoff_seconds = min(
                self._setstatus_backoff_seconds + 4, MAX_BACKOFF_SECONDS_WHEN_HOST_UNAVAILABLE
            )
            logger.info(
                "taskworker.send_update_task.temporarily_unavailable",
                extra={"task_id": result.task_id, "error": str(e)},
            )
            self._processed_tasks.put(result)
            return None

    def start_spawn_children_thread(self) -> None:
        def spawn_children_thread() -> None:
            logger.debug("taskworker.worker.spawn_children_thread.started")
            while not self._shutdown_event.is_set():
                self._children = [child for child in self._children if child.is_alive()]
                if len(self._children) >= self._concurrency:
                    time.sleep(0.1)
                    continue
                for i in range(self._concurrency - len(self._children)):
                    process = self.mp_context.Process(
                        name=f"taskworker-child-{i}",
                        target=child_process,
                        args=(
                            self._app_module,
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
                    metrics.incr(
                        "taskworker.worker.spawn_child",
                        tags={"processing_pool": self._processing_pool_name},
                    )

        self._spawn_children_thread = threading.Thread(
            name="spawn-children", target=spawn_children_thread, daemon=True
        )
        self._spawn_children_thread.start()

    def fetch_task(self) -> InflightTaskActivation | None:
        # Use the shutdown_event as a sleep mechanism
        self._shutdown_event.wait(self._gettask_backoff_seconds)
        try:
            activation = self.client.get_task(self._namespace)
        except grpc.RpcError as e:
            logger.info(
                "taskworker.fetch_task.failed",
                extra={"error": e, "processing_pool": self._processing_pool_name},
            )

            self._gettask_backoff_seconds = min(
                self._gettask_backoff_seconds + 4, MAX_BACKOFF_SECONDS_WHEN_HOST_UNAVAILABLE
            )
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
            self._gettask_backoff_seconds = min(self._gettask_backoff_seconds + 1, 5)
            return None

        self._gettask_backoff_seconds = 0
        return activation
