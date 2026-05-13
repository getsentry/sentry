from __future__ import annotations

import datetime
import logging
from collections.abc import Callable
from typing import TypeVar

from django.db.models import Model
from taskbroker_client.constants import CompressionType
from taskbroker_client.registry import TaskNamespace
from taskbroker_client.retry import Retry
from taskbroker_client.task import P, R, Task

from sentry.silo.base import SiloMode
from sentry.taskworker.silolimiter import TaskSiloLimit
from sentry.utils import metrics

ModelT = TypeVar("ModelT", bound=Model)

logger = logging.getLogger(__name__)


def load_model_from_db(
    tp: type[ModelT], instance_or_id: ModelT | int, allow_cache: bool = True
) -> ModelT:
    """Utility function to allow a task to transition to passing ids rather than model instances."""
    if isinstance(instance_or_id, int):
        if hasattr(tp.objects, "get_from_cache") and allow_cache:
            return tp.objects.get_from_cache(pk=instance_or_id)
        return tp.objects.get(pk=instance_or_id)
    return instance_or_id


def instrumented_task(
    name: str,
    namespace: TaskNamespace,
    alias: str | None = None,
    alias_namespace: TaskNamespace | None = None,
    retry: Retry | None = None,
    expires: int | datetime.timedelta | None = None,
    processing_deadline_duration: int | datetime.timedelta | None = None,
    at_most_once: bool = False,
    wait_for_delivery: bool = False,
    compression_type: CompressionType = CompressionType.PLAINTEXT,
    report_timeout_errors: bool = True,
    silenced_exceptions: tuple[type[BaseException], ...] | None = None,
    silo_mode: SiloMode | None = None,
    **kwargs,
) -> Callable[[Callable[P, R]], Task[P, R]]:
    """
    Decorator for defining tasks.

    Includes a few application specific batteries like:

    - statsd metrics for duration and memory usage.
    - sentry sdk tagging.
    - hybrid cloud silo restrictions
    - alias and alias namespace for renaming a task or moving it to a different namespace

    Basic task definition:
        @instrumented_task(
            name="sentry.tasks.some_task",
            namespace=some_namespace,
        )
        def func():
            ...

    Renaming a task and/or moving task to a different namespace:
        @instrumented_task(
            name="sentry.tasks.new_task_name",
            namespace=new_namespace,
            alias="sentry.tasks.previous_task_name",
            alias_namespace=previous_namespace,
        )
        def func():
            ...

    Parameters
    ----------

    name : str
        The name of the task. This is serialized and must be stable across deploys.
    namespace : TaskNamespace
        The namespace of the task. Tasks in a given namespace are all processed by the same taskbroker pool.
    alias : str | None
        The alias of the task. Used for maintaining backwards compatibility after renaming a task.
    alias_namespace : TaskNamespace | None
        The namespace of the alias task. Used to move a task to a different namespace.
    retry : Retry | None
        The retry policy for the task. If none and at_most_once is not enabled
        the Task namespace default retry policy will be used.
        The task will only retry for specified exceptions in the Retry object.
        i.e. Retry(on=(Exception,), ignore=(IgnorableException,))
    expires : int | datetime.timedelta | None
        The duration in seconds that a task has to start execution.
        After received_at + expires has passed an activation is expired and will not be executed.
    processing_deadline_duration : int | datetime.timedelta | None
        The duration in seconds that a worker has to complete task execution.
        When a taskbroker gives an activation to the taskworker to execute, a result is expected
        in this many seconds. If not provided, the default task duration of
        DEFAULT_PROCESSING_DEADLINE will be used.
    at_most_once : bool
        Enable at-most-once execution. Tasks with `at_most_once` cannot
        define retry policies, and use a worker side idempotency key to
        to guarantee that they are only attempted once (regardless of success or failure).
    wait_for_delivery : bool
        If true, the task will wait for the delivery report to be received
        before returning.
    compression_type : CompressionType
        The compression type to use to compress the task parameters.
    report_timeout_errors : bool
        Enable reporting of ProcessingDeadlineExceededError to Sentry.
    silenced_exceptions : tuple[type[BaseException], ...] | None
        A tuple of exception types that will not be reported by Sentry.
    silo_mode : SiloMode | None
        The silo that the task will run in. This should be the silo that the task was called from.
    """

    def wrapped(func: Callable[P, R]) -> Task[P, R]:
        task = namespace.register(
            name=name,
            retry=retry,
            expires=expires,
            processing_deadline_duration=processing_deadline_duration,
            at_most_once=at_most_once,
            wait_for_delivery=wait_for_delivery,
            compression_type=compression_type,
            report_timeout_errors=report_timeout_errors,
            silenced_exceptions=silenced_exceptions,
        )(func)

        if silo_mode:
            silo_limiter = TaskSiloLimit(silo_mode)
            task = silo_limiter(task)
            namespace._registered_tasks[name] = task

        # If an alias is provided, register the task for both "name" and "alias" under namespace
        # If an alias namespace is provided, register the task in both namespace and alias_namespace
        # When both are provided, register tasks namespace."name" and alias_namespace."alias"
        if alias or alias_namespace:
            target_alias = alias if alias else name
            target_alias_namespace = alias_namespace if alias_namespace else namespace
            alias_task = target_alias_namespace.register(
                name=target_alias,
                retry=retry,
                expires=expires,
                processing_deadline_duration=processing_deadline_duration,
                at_most_once=at_most_once,
                wait_for_delivery=wait_for_delivery,
                compression_type=compression_type,
                report_timeout_errors=report_timeout_errors,
                silenced_exceptions=silenced_exceptions,
            )(func)

            if silo_mode:
                silo_limiter = TaskSiloLimit(silo_mode)
                alias_task = silo_limiter(alias_task)
                target_alias_namespace._registered_tasks[target_alias] = alias_task

        return task

    return wrapped


def track_group_async_operation(function):
    def wrapper(*args, **kwargs):
        from sentry.utils import snuba

        try:
            response = function(*args, **kwargs)
            metrics.incr(
                "group.update.async_response",
                sample_rate=1.0,
                tags={"status": 500 if response is False else 200},
            )
            return response
        except snuba.RateLimitExceeded:
            metrics.incr("group.update.async_response", sample_rate=1.0, tags={"status": 429})
            raise
        except Exception:
            metrics.incr("group.update.async_response", sample_rate=1.0, tags={"status": 500})
            # Continue raising the error now that we've incr the metric
            raise

    return wrapper
