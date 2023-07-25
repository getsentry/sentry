from sentry.utils import metrics


def ds_task_with_context(max_task_execution: int):
    def wrapper(func):
        def _wrapper(*args, **kwargs):
            function_name = func.__name__
            task_name = f"sentry.tasks.dynamic_sampling.{function_name}"

            # We will count how many times the function is run.
            metrics.incr(f"{task_name}.start", sample_rate=1.0)
            # We will count how much it takes to run the function.
            with metrics.timer(task_name, sample_rate=1.0):
                return func(*args, **kwargs)

        return _wrapper

    return wrapper
