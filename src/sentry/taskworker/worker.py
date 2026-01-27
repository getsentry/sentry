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
from sentry_protos.taskbroker.v1 import taskbroker_pb2, taskbroker_pb2_grpc
from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    FetchNextTask,
    TaskActivation,
)

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
from sentry.taskworker.task import Task
from sentry.taskworker.workerchild import child_process, load_parameters
from sentry.utils import metrics

logger = logging.getLogger("sentry.taskworker.worker")


class WorkerServicer(taskbroker_pb2_grpc.WorkerServiceServicer):
    """
    gRPC servicer that receives task activations pushed from the broker
    """

    def __init__(self, worker: TaskWorker) -> None:
        self.worker = worker

        app = import_app(worker._app_module)
        app.load_modules()

        self.taskregistry = app.taskregistry

    def _get_known_task(self, activation: TaskActivation) -> Task[Any, Any] | None:
        """Get a task function from the registry."""

        if not self.taskregistry.contains(activation.namespace):
            logger.error(
                "taskworker.invalid_namespace",
                extra={"namespace": activation.namespace, "taskname": activation.taskname},
            )

            return None

        namespace = self.taskregistry.get(activation.namespace)

        if not namespace.contains(activation.taskname):
            logger.error(
                "taskworker.invalid_taskname",
                extra={"namespace": activation.namespace, "taskname": activation.taskname},
            )

            return None

        return namespace.get(activation.taskname)

    def _execute_activation(self, fun: Task[Any, Any], activation: TaskActivation) -> None:
        """Execute a task activation synchronously."""

        headers = {k: v for k, v in activation.headers.items()}
        parameters = load_parameters(activation.parameters, headers)

        args = parameters.get("args", [])
        kwargs = parameters.get("kwargs", {})

        if "__start_time" in kwargs:
            kwargs.pop("__start_time")

        # Execute the task function
        fun(*args, **kwargs)

    def PushTask(
        self,
        request: taskbroker_pb2.PushTaskRequest,
        context: grpc.ServicerContext,
    ) -> taskbroker_pb2.PushTaskResponse:
        """Handle incoming task activation."""
        # Create `InflightTaskActivation` from the pushed task
        activation = request.task

        # Get the task function from the registry
        fun = self._get_known_task(activation)

        if not fun:
            logger.error(
                "taskworker.unknown_task",
                extra={
                    "namespace": activation.namespace,
                    "taskname": activation.taskname,
                },
            )

            return taskbroker_pb2.PushTaskResponse(status=TASK_ACTIVATION_STATUS_FAILURE)

        # Execute the task synchronously
        try:
            self._execute_activation(fun, activation)
            return taskbroker_pb2.PushTaskResponse(status=TASK_ACTIVATION_STATUS_COMPLETE)
        except Exception as e:
            logger.exception(
                "taskworker.task_execution_failed",
                extra={
                    "namespace": activation.namespace,
                    "taskname": activation.taskname,
                    "error": str(e),
                },
            )

            return taskbroker_pb2.PushTaskResponse(status=TASK_ACTIVATION_STATUS_FAILURE)


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
        namespace: str | None = None,
        concurrency: int = 1,
        grpc_port: int = 50052,
        **kwargs: dict[str, Any],
    ) -> None:
        self.options = kwargs
        self._app_module = app_module
        self._namespace = namespace
        self._concurrency = concurrency
        self._grpc_port = grpc_port
        self._processes: list[BaseProcess] = []

    def _run_server_process(self, worker_id: int) -> None:
        """
        Run a single gRPC server process.

        This is executed in a separate process and uses SO_REUSEPORT to share the port
        with other worker processes.
        """
        # Ignore SIGINT (Ctrl+C) - let parent handle shutdown
        signal.signal(signal.SIGINT, signal.SIG_IGN)

        # Start gRPC server with SO_REUSEPORT enabled
        # This allows multiple processes to bind to the same port
        server = grpc.server(
            ThreadPoolExecutor(max_workers=10),
            options=[
                ("grpc.so_reuseport", 1),
            ],
        )
        taskbroker_pb2_grpc.add_WorkerServiceServicer_to_server(WorkerServicer(self), server)
        server.add_insecure_port(f"[::]:{self._grpc_port}")
        server.start()
        logger.info(
            "taskworker.grpc_server.started",
            extra={
                "port": self._grpc_port,
                "worker_id": worker_id,
                "pid": multiprocessing.current_process().pid,
            },
        )

        # Wait for termination - parent will send SIGTERM
        server.wait_for_termination()

    def start(self) -> int:
        """
        Run the worker main loop

        Once started a Worker will spawn multiple server processes that share the same port
        using SO_REUSEPORT. The OS kernel handles load balancing across the processes.
        """
        # Use fork context to preserve parent process state (Django initialization, etc.)
        ctx = multiprocessing.get_context("fork")

        # Spawn multiple server processes
        for i in range(self._concurrency):
            process = ctx.Process(target=self._run_server_process, args=(i,))
            process.start()
            self._processes.append(process)
            logger.info(
                "taskworker.process.started",
                extra={"worker_id": i, "pid": process.pid, "total_workers": self._concurrency},
            )

        # Convert signals to gracefully shutdown all child processes
        def signal_handler(signum: int, frame: Any) -> None:
            logger.info("taskworker.shutdown_signal_received", extra={"signal": signum})
            for process in self._processes:
                if process.is_alive():
                    process.terminate()

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        try:
            # Wait for all processes to complete
            for process in self._processes:
                process.join()
        except KeyboardInterrupt:
            logger.info("taskworker.keyboard_interrupt")
            for process in self._processes:
                if process.is_alive():
                    process.terminate()
                    process.join(timeout=5)

        return 0
