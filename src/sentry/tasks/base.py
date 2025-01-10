from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from datetime import datetime
from functools import wraps
from random import random
from typing import Any, TypeVar

from celery import current_task
from django.conf import settings
from django.db.models import Model

from sentry import options
from sentry.celery import app
from sentry.silo.base import SiloLimit, SiloMode
from sentry.utils import metrics
from sentry.utils.memory import track_memory_usage
from sentry.utils.sdk import Scope, capture_exception

ModelT = TypeVar("ModelT", bound=Model)

logger = logging.getLogger(__name__)


class TaskSiloLimit(SiloLimit):
    """
    Silo limiter for celery tasks

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
        # Replace the celery.Task interface we use.
        replacements = {"delay", "apply_async", "s", "signature", "retry", "apply", "run"}
        for attr_name in replacements:
            task_attr = getattr(decorated_task, attr_name)
            if callable(task_attr):
                limited_attr = self.create_override(task_attr)
                setattr(decorated_task, attr_name, limited_attr)

        limited_func = self.create_override(decorated_task)
        if hasattr(decorated_task, "name"):
            limited_func.name = decorated_task.name
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


def instrumented_task(name, stat_suffix=None, silo_mode=None, record_timing=False, **kwargs):
    """
    Decorator for defining celery tasks.

    Includes a few application specific batteries like:

    - statsd metrics for duration and memory usage.
    - sentry sdk tagging.
    - hybrid cloud silo restrictions
    - disabling of result collection.
    """

    def wrapped(func):
        @wraps(func)
        def _wrapped(*args, **kwargs):
            record_timing_rollout = options.get("sentry.tasks.record.timing.rollout")
            do_record_timing_rollout = False
            if record_timing_rollout and record_timing_rollout > random():
                do_record_timing_rollout = True

            record_queue_wait_time = record_timing or do_record_timing_rollout

            # Use a try/catch here to contain the blast radius of an exception being unhandled through the options lib
            # Unhandled exception could cause all tasks to be effected and not work

            # TODO(dcramer): we want to tag a transaction ID, but overriding
            # the base on app.task seems to cause problems w/ Celery internals
            transaction_id = kwargs.pop("__transaction_id", None)
            start_time = kwargs.pop("__start_time", None)

            key = "jobs.duration"
            if stat_suffix:
                instance = f"{name}.{stat_suffix(*args, **kwargs)}"
            else:
                instance = name

            if start_time and record_queue_wait_time:
                curr_time = datetime.now().timestamp()
                duration = (curr_time - start_time) * 1000
                metrics.distribution(
                    "jobs.queue_time", duration, instance=instance, unit="millisecond"
                )

            scope = Scope.get_isolation_scope()
            scope.set_tag("task_name", name)
            scope.set_tag("transaction_id", transaction_id)

            with (
                metrics.timer(key, instance=instance),
                track_memory_usage("jobs.memory_change", instance=instance),
            ):
                result = func(*args, **kwargs)

            return result

        # If the split task router is configured for the task, always use queues defined
        # in the split task configuration
        if name in settings.CELERY_SPLIT_QUEUE_TASK_ROUTES and "queue" in kwargs:
            q = kwargs.pop("queue")
            logger.warning("ignoring queue: %s, using value from CELERY_SPLIT_QUEUE_TASK_ROUTES", q)

        # We never use result backends in Celery. Leaving `trail=True` means that if we schedule
        # many tasks from a parent task, each task leaks memory. This can lead to the scheduler
        # being OOM killed.
        kwargs["trail"] = False
        task = app.task(name=name, **kwargs)(_wrapped)

        if silo_mode:
            silo_limiter = TaskSiloLimit(silo_mode)
            return silo_limiter(task)
        return task

    return wrapped


def retry(
    func: Callable[..., Any] | None = None,
    on: type[Exception] | tuple[type[Exception], ...] = (Exception,),
    exclude: type[Exception] | tuple[type[Exception], ...] = (),
    ignore: type[Exception] | tuple[type[Exception], ...] = (),
) -> Callable[..., Callable[..., Any]]:
    """
    >>> @retry(on=(Exception,), exclude=(AnotherException,), ignore=(IgnorableException,))
    >>> def my_task():
    >>>     ...
    """

    if func:
        return retry()(func)

    def inner(func):
        @wraps(func)
        def wrapped(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except ignore:
                return
            except exclude:
                raise
            except on as exc:
                capture_exception()
                current_task.retry(exc=exc)

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
