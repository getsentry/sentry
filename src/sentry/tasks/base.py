from __future__ import annotations

import resource
from contextlib import contextmanager
from datetime import datetime
from functools import wraps
from typing import Any, Callable, Iterable

from celery import current_task

from sentry.celery import app
from sentry.silo.base import SiloLimit, SiloMode
from sentry.utils import metrics
from sentry.utils.sdk import capture_exception, configure_scope


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


def get_rss_usage():
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss


@contextmanager
def track_memory_usage(metric, **kwargs):
    before = get_rss_usage()
    try:
        yield
    finally:
        metrics.distribution(metric, get_rss_usage() - before, unit="byte", **kwargs)


def load_model_from_db(cls, instance_or_id, allow_cache=True):
    """Utility function to allow a task to transition to passing ids rather than model instances."""
    if isinstance(instance_or_id, int):
        if hasattr(cls.objects, "get_from_cache") and allow_cache:
            return cls.objects.get_from_cache(pk=instance_or_id)
        return cls.objects.get(pk=instance_or_id)
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

            # TODO(dcramer): we want to tag a transaction ID, but overriding
            # the base on app.task seems to cause problems w/ Celery internals
            transaction_id = kwargs.pop("__transaction_id", None)
            start_time = kwargs.pop("__start_time", None)

            key = "jobs.duration"
            if stat_suffix:
                instance = f"{name}.{stat_suffix(*args, **kwargs)}"
            else:
                instance = name

            if start_time and record_timing:
                curr_time = datetime.now().timestamp()
                duration = (curr_time - start_time) * 1000
                metrics.distribution(
                    "jobs.queue_time", duration, instance=instance, unit="millisecond"
                )

            with configure_scope() as scope:
                scope.set_tag("task_name", name)
                scope.set_tag("transaction_id", transaction_id)

            with metrics.timer(key, instance=instance), track_memory_usage(
                "jobs.memory_change", instance=instance
            ):
                result = func(*args, **kwargs)

            return result

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
