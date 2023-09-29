from functools import wraps

import sentry_sdk

from sentry.dynamic_sampling.tasks.common import TimeoutException
from sentry.dynamic_sampling.tasks.logging import log_task_execution, log_task_timeout
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.utils import metrics


def _compute_task_name(function_name: str) -> str:
    return f"sentry.tasks.dynamic_sampling.{function_name}"


def dynamic_sampling_task_with_context(max_task_execution: int):
    def wrapper(func):
        @wraps(func)
        def _wrapper():
            function_name = func.__name__
            task_name = _compute_task_name(function_name)

            # We will count how many times the function is run.
            metrics.incr(f"{task_name}.start", sample_rate=1.0)
            # We will count how much it takes to run the function.
            with metrics.timer(task_name, sample_rate=1.0):
                context = TaskContext(task_name, max_task_execution)

                try:
                    func(context=context)
                except TimeoutException:
                    sentry_sdk.set_extra("context-data", context.to_dict())
                    log_task_timeout(context)
                    raise
                else:
                    sentry_sdk.set_extra("context-data", context.to_dict())
                    sentry_sdk.capture_message(f"timing for {task_name}")
                    log_task_execution(context)

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
