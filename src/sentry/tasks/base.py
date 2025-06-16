from __future__ import annotations

import functools
import logging
import random
from collections.abc import Callable, Iterable
from datetime import datetime
from typing import Any, ParamSpec, TypeVar

import sentry_sdk
from celery import Task
from django.conf import settings
from django.db.models import Model

from sentry import options
from sentry.celery import app
from sentry.silo.base import SiloLimit, SiloMode
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.retry import retry_task
from sentry.taskworker.task import Task as TaskworkerTask
from sentry.utils import metrics
from sentry.utils.memory import track_memory_usage

ModelT = TypeVar("ModelT", bound=Model)

P = ParamSpec("P")
R = TypeVar("R")

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


def taskworker_override(
    celery_task_attr: Callable[P, R],
    taskworker_attr: Callable[P, R],
    namespace: str,
    task_name: str,
) -> Callable[P, R]:
    def override(*args: P.args, **kwargs: P.kwargs) -> R:
        rollout_rate = 0
        option_flag = f"taskworker.{namespace}.rollout"
        rollout_map = options.get(option_flag)
        if rollout_map:
            if task_name in rollout_map:
                rollout_rate = rollout_map.get(task_name, 0)
            elif "*" in rollout_map:
                rollout_rate = rollout_map.get("*", 0)

        if rollout_rate > random.random():
            return taskworker_attr(*args, **kwargs)

        return celery_task_attr(*args, **kwargs)

    functools.update_wrapper(override, celery_task_attr)
    return override


def override_task(
    celery_task: Task,
    taskworker_task: TaskworkerTask,
    taskworker_config: TaskworkerConfig,
    task_name: str,
) -> Task:
    """
    This function is used to override SentryTasks methods with TaskworkerTask methods
    depending on the rollout percentage set in sentry options.

    This is used to migrate tasks from celery to taskworker in a controlled manner.
    """
    replacements = {"delay", "apply_async"}
    for attr_name in replacements:
        celery_task_attr = getattr(celery_task, attr_name)
        taskworker_attr = getattr(taskworker_task, attr_name)
        if callable(celery_task_attr) and callable(taskworker_attr):
            limited_attr = taskworker_override(
                celery_task_attr,
                taskworker_attr,
                taskworker_config.namespace.name,
                task_name,
            )
            setattr(celery_task, attr_name, limited_attr)

    return celery_task


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
    stat_suffix=None,
    silo_mode=None,
    record_timing=False,
    taskworker_config=None,
    **kwargs,
):
    """
    Decorator for defining celery tasks.

    Includes a few application specific batteries like:

    - statsd metrics for duration and memory usage.
    - sentry sdk tagging.
    - hybrid cloud silo restrictions
    - disabling of result collection.
    """

    def wrapped(func):
        @functools.wraps(func)
        def _wrapped(*args, **kwargs):
            record_queue_wait_time = record_timing

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

            scope = sentry_sdk.get_isolation_scope()
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
        if taskworker_config:
            taskworker_task = taskworker_config.namespace.register(
                name=name,
                retry=taskworker_config.retry,
                expires=taskworker_config.expires,
                processing_deadline_duration=taskworker_config.processing_deadline_duration,
                at_most_once=taskworker_config.at_most_once,
                wait_for_delivery=taskworker_config.wait_for_delivery,
            )(func)

            task = override_task(task, taskworker_task, taskworker_config, name)
        else:
            raise Exception(
                f"taskworker_config must be defined, please add TaskworkerConfig to instrumented_task call for {name}"
            )

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
    ignore_and_capture: type[Exception] | tuple[type[Exception], ...] = (),
) -> Callable[..., Callable[..., Any]]:
    """
    >>> @retry(on=(Exception,), exclude=(AnotherException,), ignore=(IgnorableException,))
    >>> def my_task():
    >>>     ...
    """

    if func:
        return retry()(func)

    def inner(func):
        @functools.wraps(func)
        def wrapped(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except ignore:
                return
            except ignore_and_capture:
                sentry_sdk.capture_exception(level="info")
                return
            except exclude:
                raise
            except on as exc:
                sentry_sdk.capture_exception()
                retry_task(exc)

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
