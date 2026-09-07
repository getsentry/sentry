from collections.abc import Callable
from functools import wraps
from random import random
from typing import Any

import sentry_sdk

from sentry import options
from sentry.utils import metrics

LEGACY_KILLSWITCH_OPTION = "dynamic-sampling.legacy.killswitch"


def sample_function(function: Callable[..., Any], _sample_rate: float = 1.0, **kwargs: Any) -> None:
    """
    Calls the supplied function with a uniform probability of `_sample_rate`.
    """
    if _sample_rate >= 1.0 or 0.0 <= random() <= _sample_rate:
        function(**kwargs)


def _compute_task_name(function_name: str) -> str:
    return f"sentry.tasks.dynamic_sampling.{function_name}"


def dynamic_sampling_task(func: Callable[..., Any]) -> Callable[..., Any]:
    """
    Decorator to wrap dynamic sampling related tasks to record metrics for the execution of
    the task, durations associated with it as metrics, and capture all exceptions in sentry.
    """

    @wraps(func)
    def _wrapper(*args: Any, **kwargs: Any) -> Any:
        function_name = func.__name__
        task_name = _compute_task_name(function_name)
        metrics.incr(f"{task_name}.start", sample_rate=1.0)
        with metrics.timer(task_name, sample_rate=1.0):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                raise

    return _wrapper


def legacy_dynamic_sampling_job(func: Callable[..., Any]) -> Callable[..., Any]:
    """
    Decorator for the scheduled entry points of the legacy dynamic sampling pipeline.
    While the legacy killswitch option is engaged, the job returns before it does any work.
    """

    @wraps(func)
    def _wrapper(*args: Any, **kwargs: Any) -> Any:
        if options.get(LEGACY_KILLSWITCH_OPTION):
            metrics.incr(f"{_compute_task_name(func.__name__)}.killswitched", sample_rate=1.0)
            return None
        return func(*args, **kwargs)

    return _wrapper
