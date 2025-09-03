from collections.abc import Callable
from functools import wraps
from random import random
from typing import Any

from sentry.utils import metrics


def sample_function(function: Callable[..., Any], _sample_rate: float = 1.0, **kwargs: Any) -> None:
    """
    Calls the supplied function with a uniform probability of `_sample_rate`.
    """
    if _sample_rate >= 1.0 or 0.0 <= random() <= _sample_rate:
        function(**kwargs)


def _compute_task_name(function_name: str) -> str:
    return f"sentry.tasks.dynamic_sampling.{function_name}"


def dynamic_sampling_task(func: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(func)
    def _wrapper(*args: Any, **kwargs: Any) -> Any:
        function_name = func.__name__
        task_name = _compute_task_name(function_name)

        # We will count how many times the function is run.
        metrics.incr(f"{task_name}.start", sample_rate=1.0)
        # We will count how much it takes to run the function.
        with metrics.timer(task_name, sample_rate=1.0):
            return func(*args, **kwargs)

    return _wrapper
