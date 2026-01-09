from __future__ import annotations

import base64
import contextlib
import logging
import queue
import signal
import time
from collections.abc import Callable, Generator
from multiprocessing.synchronize import Event
from types import FrameType
from typing import Any

# XXX: Don't import any modules that will import django here, do those within child_process
import orjson
import sentry_sdk
import zstandard as zstd
from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    TaskActivation,
    TaskActivationStatus,
)
from sentry_sdk.consts import OP, SPANDATA, SPANSTATUS
from sentry_sdk.crons import MonitorStatus, capture_checkin

from sentry.taskworker.client.inflight_task_activation import InflightTaskActivation
from sentry.taskworker.client.processing_result import ProcessingResult
from sentry.taskworker.constants import CompressionType

logger = logging.getLogger("sentry.taskworker.worker")


class ProcessingDeadlineExceeded(BaseException):
    pass


def child_worker_init(process_type: str) -> None:
    """
    Configure django and load task modules for workers
    Child worker processes are spawned and don't inherit db
    connections or configuration from the parent process.
    """
    from sentry.runner import configure

    if process_type == "spawn":
        configure()


@contextlib.contextmanager
def timeout_alarm(
    seconds: int, handler: Callable[[int, FrameType | None], None]
) -> Generator[None]:
    """
    Context manager to handle SIGALRM handlers

    To prevent tasks from consuming a worker forever, we set a timeout
    alarm that will interrupt tasks that run longer than
    their processing_deadline.
    """
    original = signal.signal(signal.SIGALRM, handler)
    try:
        signal.alarm(seconds)
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, original)


def load_parameters(data: str, headers: dict[str, str]) -> dict[str, Any]:
    compression_type = headers.get("compression-type", None)
    if not compression_type or compression_type == CompressionType.PLAINTEXT.value:
        return orjson.loads(data)
    elif compression_type == CompressionType.ZSTD.value:
        return orjson.loads(zstd.decompress(base64.b64decode(data)))
    else:
        logger.error(
            "Unsupported compression type: %s. Continuing with plaintext.", compression_type
        )
        return orjson.loads(data)


def status_name(status: TaskActivationStatus.ValueType) -> str:
    """Convert a TaskActivationStatus to a human readable name"""
    if status == TASK_ACTIVATION_STATUS_COMPLETE:
        return "complete"
    if status == TASK_ACTIVATION_STATUS_FAILURE:
        return "failure"
    if status == TASK_ACTIVATION_STATUS_RETRY:
        return "retry"
    return f"unknown-{status}"


def child_process(
    app_module: str,
    child_tasks: queue.Queue[InflightTaskActivation],
    processed_tasks: queue.Queue[ProcessingResult],
    shutdown_event: Event,
    max_task_count: int | None,
    processing_pool_name: str,
    process_type: str,
) -> None:
    """
    The entrypoint for spawned worker children.

    Any import that could pull in django needs to be put inside this functiona
    and not the module root. If modules that include django are imported at
    the module level the wrong django settings will be used.
    """
    child_worker_init(process_type)

    from sentry.taskworker.app import import_app
    from sentry.taskworker.retry import NoRetriesRemainingError
    from sentry.taskworker.state import clear_current_task, current_task, set_current_task
    from sentry.taskworker.task import Task
    from sentry.utils import metrics
    from sentry.utils.memory import track_memory_usage

    app = import_app(app_module)
    app.load_modules()
    taskregistry = app.taskregistry

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

    def run_worker(
        child_tasks: queue.Queue[InflightTaskActivation],
        processed_tasks: queue.Queue[ProcessingResult],
        shutdown_event: Event,
        max_task_count: int | None,
        processing_pool_name: str,
        process_type: str,
    ) -> None:
        processed_task_count = 0

        def handle_alarm(signum: int, frame: FrameType | None) -> None:
            """
            Handle SIGALRM

            If we hit an alarm in a child, we need to push a result
            and terminate the child.
            """
            deadline = -1
            current = current_task()
            taskname = "unknown"
            if current:
                taskname = current.taskname
                deadline = current.processing_deadline_duration
            raise ProcessingDeadlineExceeded(
                f"execution deadline of {deadline} seconds exceeded by {taskname}"
            )

        while not shutdown_event.is_set():
            if max_task_count and processed_task_count >= max_task_count:
                metrics.incr(
                    "taskworker.worker.max_task_count_reached",
                    tags={"count": processed_task_count, "processing_pool": processing_pool_name},
                )
                logger.info(
                    "taskworker.max_task_count_reached", extra={"count": processed_task_count}
                )
                break

            try:
                inflight = child_tasks.get(timeout=1.0)
            except queue.Empty:
                metrics.incr(
                    "taskworker.worker.child_task_queue_empty",
                    tags={"processing_pool": processing_pool_name},
                )
                continue

            task_func = _get_known_task(inflight.activation)
            if not task_func:
                metrics.incr(
                    "taskworker.worker.unknown_task",
                    tags={
                        "namespace": inflight.activation.namespace,
                        "taskname": inflight.activation.taskname,
                        "processing_pool": processing_pool_name,
                    },
                    sample_rate=1.0,
                )
                with sentry_sdk.isolation_scope() as scope:
                    scope.set_tag("taskname", inflight.activation.taskname)
                    scope.set_tag("namespace", inflight.activation.namespace)
                    scope.set_tag("processing_pool", processing_pool_name)
                    scope.set_extra("activation", str(inflight.activation))
                    scope.capture_event(
                        {
                            "message": f"Unregistered task {inflight.activation.taskname} was not executed",
                            "level": "error",
                        }
                    )

                processed_tasks.put(
                    ProcessingResult(
                        task_id=inflight.activation.id,
                        status=TASK_ACTIVATION_STATUS_FAILURE,
                        host=inflight.host,
                        receive_timestamp=inflight.receive_timestamp,
                    )
                )
                continue

            if task_func.at_most_once:
                if app.should_attempt_at_most_once(inflight.activation):
                    metrics.incr(
                        "taskworker.task.at_most_once.executed",
                        tags={
                            "namespace": inflight.activation.namespace,
                            "taskname": inflight.activation.taskname,
                            "processing_pool": processing_pool_name,
                        },
                    )
                else:
                    metrics.incr(
                        "taskworker.worker.at_most_once.skipped",
                        tags={
                            "namespace": inflight.activation.namespace,
                            "taskname": inflight.activation.taskname,
                            "processing_pool": processing_pool_name,
                        },
                    )
                    continue

            set_current_task(inflight.activation)

            next_state = TASK_ACTIVATION_STATUS_FAILURE
            # Use time.time() so we can measure against activation.received_at
            execution_start_time = time.time()
            try:
                with timeout_alarm(inflight.activation.processing_deadline_duration, handle_alarm):
                    _execute_activation(task_func, inflight.activation)
                next_state = TASK_ACTIVATION_STATUS_COMPLETE
            except ProcessingDeadlineExceeded as err:
                with sentry_sdk.isolation_scope() as scope:
                    scope.fingerprint = [
                        "taskworker.processing_deadline_exceeded",
                        inflight.activation.namespace,
                        inflight.activation.taskname,
                    ]
                    scope.set_transaction_name(inflight.activation.taskname)
                    sentry_sdk.capture_exception(err)
                metrics.incr(
                    "taskworker.worker.processing_deadline_exceeded",
                    tags={
                        "processing_pool": processing_pool_name,
                        "namespace": inflight.activation.namespace,
                        "taskname": inflight.activation.taskname,
                    },
                )
                next_state = TASK_ACTIVATION_STATUS_FAILURE
            except Exception as err:
                retry = task_func.retry
                captured_error = False
                if retry:
                    if retry.should_retry(inflight.activation.retry_state, err):
                        logger.info(
                            "taskworker.task.retry",
                            extra={
                                "namespace": inflight.activation.namespace,
                                "taskname": inflight.activation.taskname,
                                "processing_pool": processing_pool_name,
                                "error": str(err),
                            },
                        )
                        next_state = TASK_ACTIVATION_STATUS_RETRY
                    elif retry.max_attempts_reached(inflight.activation.retry_state):
                        with sentry_sdk.isolation_scope() as scope:
                            retry_error = NoRetriesRemainingError(
                                f"{inflight.activation.taskname} has consumed all of its retries"
                            )
                            retry_error.__cause__ = err
                            scope.fingerprint = [
                                "taskworker.no_retries_remaining",
                                inflight.activation.namespace,
                                inflight.activation.taskname,
                            ]
                            scope.set_transaction_name(inflight.activation.taskname)
                            sentry_sdk.capture_exception(retry_error)
                            captured_error = True

                if not captured_error and next_state != TASK_ACTIVATION_STATUS_RETRY:
                    sentry_sdk.capture_exception(err)

            clear_current_task()
            processed_task_count += 1

            # Get completion time before pushing to queue, so we can measure queue append time
            execution_complete_time = time.time()
            with metrics.timer(
                "taskworker.worker.processed_tasks.put.duration",
                tags={
                    "processing_pool": processing_pool_name,
                },
            ):
                processed_tasks.put(
                    ProcessingResult(
                        task_id=inflight.activation.id,
                        status=next_state,
                        host=inflight.host,
                        receive_timestamp=inflight.receive_timestamp,
                    )
                )

            record_task_execution(
                inflight.activation,
                next_state,
                execution_start_time,
                execution_complete_time,
                processing_pool_name,
                inflight.host,
            )

    def _execute_activation(task_func: Task[Any, Any], activation: TaskActivation) -> None:
        """Invoke a task function with the activation parameters."""
        headers = {k: v for k, v in activation.headers.items()}
        parameters = load_parameters(activation.parameters, headers)

        args = parameters.get("args", [])
        kwargs = parameters.get("kwargs", {})

        transaction = sentry_sdk.continue_trace(
            environ_or_headers=headers,
            op="queue.task.taskworker",
            name=activation.taskname,
            origin="taskworker",
        )
        sampling_context = {
            "taskworker": {
                "task": activation.taskname,
            }
        }
        with (
            track_memory_usage(
                "taskworker.worker.memory_change",
                tags={"namespace": activation.namespace, "taskname": activation.taskname},
            ),
            sentry_sdk.isolation_scope(),
            sentry_sdk.start_transaction(transaction, custom_sampling_context=sampling_context),
        ):
            transaction.set_data(
                "taskworker-task", {"args": args, "kwargs": kwargs, "id": activation.id}
            )
            task_added_time = activation.received_at.ToDatetime().timestamp()
            # latency attribute needs to be in milliseconds
            latency = (time.time() - task_added_time) * 1000

            with sentry_sdk.start_span(
                op=OP.QUEUE_PROCESS,
                name=activation.taskname,
                origin="taskworker",
            ) as span:
                span.set_data(SPANDATA.MESSAGING_DESTINATION_NAME, activation.namespace)
                span.set_data(SPANDATA.MESSAGING_MESSAGE_ID, activation.id)
                span.set_data(SPANDATA.MESSAGING_MESSAGE_RECEIVE_LATENCY, latency)
                span.set_data(
                    SPANDATA.MESSAGING_MESSAGE_RETRY_COUNT, activation.retry_state.attempts
                )
                span.set_data(SPANDATA.MESSAGING_SYSTEM, "taskworker")

                # TODO(taskworker) remove this when doing cleanup
                # The `__start_time` parameter is spliced into task parameters by
                # sentry.celery.SentryTask._add_metadata and needs to be removed
                # from kwargs like sentry.tasks.base.instrumented_task does.
                if "__start_time" in kwargs:
                    kwargs.pop("__start_time")

                try:
                    task_func(*args, **kwargs)
                    transaction.set_status(SPANSTATUS.OK)
                except Exception:
                    transaction.set_status(SPANSTATUS.INTERNAL_ERROR)
                    raise

    def record_task_execution(
        activation: TaskActivation,
        status: TaskActivationStatus.ValueType,
        start_time: float,
        completion_time: float,
        processing_pool_name: str,
        taskbroker_host: str,
    ) -> None:
        task_added_time = activation.received_at.ToDatetime().timestamp()
        execution_duration = completion_time - start_time
        execution_latency = completion_time - task_added_time

        logger.debug(
            "taskworker.task_execution",
            extra={
                "taskname": activation.taskname,
                "execution_duration": execution_duration,
                "execution_latency": execution_latency,
                "status": status_name(status),
            },
        )
        metrics.incr(
            "taskworker.worker.execute_task",
            tags={
                "namespace": activation.namespace,
                "taskname": activation.taskname,
                "status": status_name(status),
                "processing_pool": processing_pool_name,
                "taskbroker_host": taskbroker_host,
            },
        )
        metrics.distribution(
            "taskworker.worker.execution_duration",
            execution_duration,
            tags={
                "namespace": activation.namespace,
                "taskname": activation.taskname,
                "processing_pool": processing_pool_name,
                "taskbroker_host": taskbroker_host,
            },
        )
        metrics.distribution(
            "taskworker.worker.execution_latency",
            execution_latency,
            tags={
                "namespace": activation.namespace,
                "taskname": activation.taskname,
                "processing_pool": processing_pool_name,
                "taskbroker_host": taskbroker_host,
            },
        )

        namespace = taskregistry.get(activation.namespace)
        metrics.incr(
            "taskworker.cogs.usage",
            amount=int(execution_duration * 1000),
            tags={"feature": namespace.app_feature},
        )

        if (
            "sentry-monitor-check-in-id" in activation.headers
            and "sentry-monitor-slug" in activation.headers
        ):
            monitor_status = MonitorStatus.ERROR
            if status == TASK_ACTIVATION_STATUS_COMPLETE:
                monitor_status = MonitorStatus.OK

            capture_checkin(
                monitor_slug=activation.headers["sentry-monitor-slug"],
                check_in_id=activation.headers["sentry-monitor-check-in-id"],
                duration=execution_duration,
                status=monitor_status,
            )

    # Run the worker loop
    run_worker(
        child_tasks,
        processed_tasks,
        shutdown_event,
        max_task_count,
        processing_pool_name,
        process_type,
    )
