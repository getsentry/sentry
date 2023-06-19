from sentry.utils import metrics


def dynamic_sampling_task(func):
    """
    Measures a dynamic sampling task by wrapping the function call with metrics collection.
    """

    def wrapped_func(*args, **kwargs):
        function_name = func.__name__

        # We will count how many times the function is run.
        metrics.incr(f"sentry.tasks.dynamic_sampling.{function_name}.start", sample_rate=1.0)
        # We will count how much it takes to run the function.
        with metrics.timer(f"sentry.tasks.dynamic_sampling.{function_name}", sample_rate=1.0):
            return func(*args, **kwargs)

    return wrapped_func
