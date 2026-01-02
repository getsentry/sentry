from __future__ import annotations

import datetime
import functools
import logging
from collections.abc import Callable
from typing import Any, TypeVar

import sentry_sdk
from django.db.models import Model

from sentry.taskworker.constants import CompressionType
from sentry.taskworker.registry import TaskNamespace
from sentry.taskworker.retry import Retry, RetryTaskError, retry_task
from sentry.taskworker.state import current_task
from sentry.taskworker.task import P, R, Task
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded
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
    silo_mode=None,
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
            silo_mode=silo_mode,
        )(func)
        # If an alias is provided, register the task for both "name" and "alias" under namespace
        # If an alias namespace is provided, register the task in both namespace and alias_namespace
        # When both are provided, register tasks namespace."name" and alias_namespace."alias"
        if alias or alias_namespace:
            target_alias = alias if alias else name
            target_alias_namespace = alias_namespace if alias_namespace else namespace
            target_alias_namespace.register(
                name=target_alias,
                retry=retry,
                expires=expires,
                processing_deadline_duration=processing_deadline_duration,
                at_most_once=at_most_once,
                wait_for_delivery=wait_for_delivery,
                compression_type=compression_type,
                silo_mode=silo_mode,
            )(func)
        return task

    return wrapped


def retry(
    func: Callable[..., Any] | None = None,
    on: type[Exception] | tuple[type[Exception], ...] = (Exception,),
    on_silent: type[Exception] | tuple[type[Exception], ...] = (),
    exclude: type[Exception] | tuple[type[Exception], ...] = (),
    ignore: type[Exception] | tuple[type[Exception], ...] = (),
    ignore_and_capture: type[Exception] | tuple[type[Exception], ...] = (),
    timeouts: bool = False,
    raise_on_no_retries: bool = True,
) -> Callable[..., Callable[..., Any]]:
    """
    >>> @retry(on=(Exception,), exclude=(AnotherException,), ignore=(IgnorableException,))
    >>> def my_task():
    >>>     ...

    The first set of parameters define how different exceptions are handled.
    Raising an error will still report a Sentry event.

    | Parameter          | Retry | Report | Raise | Description |
    |--------------------|-------|--------|-------|-------------|
    | on                 | Yes   | Yes    | No    | Exceptions that will trigger a retry & report to Sentry. |
    | on_silent          | Yes   | No     | No    | Exceptions that will trigger a retry but not be captured to Sentry. |
    | exclude            | No    | No     | Yes   | Exceptions that will not trigger a retry and will be raised. |
    | ignore             | No    | No     | No    | Exceptions that will be ignored and not trigger a retry & not report to Sentry. |
    | ignore_and_capture | No    | Yes    | No    | Exceptions that will not trigger a retry and will be captured to Sentry. |

    The following modifiers modify the behavior of the retry decorator.

    | Modifier               | Description |
    |------------------------|-------------|
    | timeouts               | ProcessingDeadlineExceeded trigger a retry. |
    | raise_on_no_retries    | Makes a RetryTaskError not be raised if no retries are left. |
    """
    if func:
        return retry()(func)

    timeout_exceptions: tuple[type[BaseException], ...]
    timeout_exceptions = (ProcessingDeadlineExceeded,)
    if not timeouts:
        timeout_exceptions = ()

    def inner(func):
        @functools.wraps(func)
        def wrapped(*args, **kwargs):
            task_state = current_task()
            no_retries_remaining = task_state and not task_state.retries_remaining
            try:
                return func(*args, **kwargs)
            except ignore:
                return
            except RetryTaskError:
                if not raise_on_no_retries and no_retries_remaining:
                    return
                # If we haven't been asked to ignore no-retries, pass along the RetryTaskError.
                raise
            except timeout_exceptions:
                if timeouts:
                    with sentry_sdk.isolation_scope() as scope:
                        task_state = current_task()
                        if task_state:
                            scope.fingerprint = [
                                "task.processing_deadline_exceeded",
                                task_state.namespace,
                                task_state.taskname,
                            ]
                        sentry_sdk.capture_exception(level="info")
                    retry_task(raise_on_no_retries=raise_on_no_retries)
                else:
                    raise
            except ignore_and_capture:
                sentry_sdk.capture_exception(level="info")
                return
            except exclude:
                raise
            except on_silent as exc:
                logger.info("silently retrying %s due to %s", func.__name__, exc)
                retry_task(exc, raise_on_no_retries=raise_on_no_retries)
            except on as exc:
                sentry_sdk.capture_exception()
                retry_task(exc, raise_on_no_retries=raise_on_no_retries)

        return wrapped

    return inner


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
