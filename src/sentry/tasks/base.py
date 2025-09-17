from __future__ import annotations

import functools
import logging
from collections.abc import Callable, Iterable
from typing import Any, ParamSpec, TypeVar

import sentry_sdk
from django.db.models import Model

from sentry.silo.base import SiloLimit, SiloMode
from sentry.taskworker.config import TaskworkerConfig  # noqa (used in getsentry)
from sentry.taskworker.retry import RetryError, retry_task
from sentry.taskworker.state import current_task
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded
from sentry.utils import metrics

ModelT = TypeVar("ModelT", bound=Model)

P = ParamSpec("P")
R = TypeVar("R")

logger = logging.getLogger(__name__)


class TaskSiloLimit(SiloLimit):
    """
    Silo limiter for tasks

    We don't want tasks to be spawned in the incorrect silo.
    We can't reliably cause tasks to fail as not all tasks use
    the ORM (which also has silo bound safety).
    """

    def handle_when_unavailable(
        self,
        original_method: Callable[..., Any],
        current_mode: SiloMode,
        available_modes: Iterable[SiloMode],
    ) -> Callable[..., Any]:
        def handle(*args: Any, **kwargs: Any) -> Any:
            name = original_method.__name__
            message = f"Cannot call or spawn {name} in {current_mode},"
            raise self.AvailabilityError(message)

        return handle

    def __call__(self, decorated_task: Any) -> Any:
        # Replace the sentry.taskworker.Task interface used to schedule tasks.
        replacements = {"delay", "apply_async"}
        for attr_name in replacements:
            task_attr = getattr(decorated_task, attr_name)
            if callable(task_attr):
                limited_attr = self.create_override(task_attr)
                setattr(decorated_task, attr_name, limited_attr)

        limited_func = self.create_override(decorated_task)
        if hasattr(decorated_task, "name"):
            limited_func.name = decorated_task.name  # type: ignore[attr-defined]
        return limited_func


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
    name,
    silo_mode=None,
    taskworker_config=None,
    **kwargs,
):
    """
    Decorator for defining tasks.

    Includes a few application specific batteries like:

    - statsd metrics for duration and memory usage.
    - sentry sdk tagging.
    - hybrid cloud silo restrictions
    - disabling of result collection.
    """

    def wrapped(func):
        assert taskworker_config, "The `taskworker_config` parameter is required to define a task"
        task = taskworker_config.namespace.register(
            name=name,
            retry=taskworker_config.retry,
            expires=taskworker_config.expires,
            processing_deadline_duration=taskworker_config.processing_deadline_duration,
            at_most_once=taskworker_config.at_most_once,
            wait_for_delivery=taskworker_config.wait_for_delivery,
            compression_type=taskworker_config.compression_type,
        )(func)

        if silo_mode:
            silo_limiter = TaskSiloLimit(silo_mode)
            return silo_limiter(task)
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

    If timeouts is True, task timeout exceptions will trigger a retry.
    If it is False, timeout exceptions will behave as specified by the other parameters.
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
            try:
                return func(*args, **kwargs)
            except ignore:
                return
            except RetryError:
                # We shouldn't interfere with exceptions that exist to communicate
                # retry state.
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
