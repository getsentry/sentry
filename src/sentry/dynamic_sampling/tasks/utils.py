from collections.abc import Callable
from functools import wraps
from random import random
from typing import Concatenate, ParamSpec

from sentry import features
from sentry.constants import SAMPLING_MODE_DEFAULT
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.organization import Organization
from sentry.utils import metrics


def sample_function(function, _sample_rate: float = 1.0, **kwargs):
    """
    Calls the supplied function with a uniform probability of `_sample_rate`.
    """
    if _sample_rate >= 1.0 or 0.0 <= random() <= _sample_rate:
        function(**kwargs)


def has_dynamic_sampling(organization: Organization | None) -> bool:
    # If an organization can't be fetched, we will assume it has no dynamic sampling.
    if organization is None:
        return False

    return features.has("organizations:dynamic-sampling", organization)


def has_custom_dynamic_sampling(organization: Organization | None) -> bool:
    return organization is not None and features.has(
        "organizations:dynamic-sampling-custom", organization
    )


def is_project_mode_sampling(organization: Organization | None) -> bool:
    return (
        organization is not None
        and has_custom_dynamic_sampling(organization)
        and organization.get_option("sentry:sampling_mode", SAMPLING_MODE_DEFAULT)
        == DynamicSamplingMode.PROJECT
    )


def _compute_task_name(function_name: str) -> str:
    return f"sentry.tasks.dynamic_sampling.{function_name}"


P = ParamSpec("P")
DynamicTaskWithContextType = Callable[Concatenate[TaskContext, P], None]


def dynamic_sampling_task_with_context(
    max_task_execution: int,
) -> Callable[[DynamicTaskWithContextType], Callable[P, None]]:
    def wrapper(func: DynamicTaskWithContextType) -> Callable[P, None]:
        @wraps(func)
        def _wrapper(*args: P.args, **kwargs: P.kwargs) -> None:
            function_name = func.__name__
            task_name = _compute_task_name(function_name)

            # We will count how many times the function is run.
            metrics.incr(f"{task_name}.start", sample_rate=1.0)
            # We will count how much it takes to run the function.
            with metrics.timer(task_name, sample_rate=1.0):
                context = TaskContext(task_name, max_task_execution)
                func(context, *args, **kwargs)

        return _wrapper

    return wrapper


def dynamic_sampling_task(func):
    @wraps(func)
    def _wrapper(*args, **kwargs):
        function_name = func.__name__
        task_name = _compute_task_name(function_name)

        # We will count how many times the function is run.
        metrics.incr(f"{task_name}.start", sample_rate=1.0)
        # We will count how much it takes to run the function.
        with metrics.timer(task_name, sample_rate=1.0):
            return func(*args, **kwargs)

    return _wrapper
