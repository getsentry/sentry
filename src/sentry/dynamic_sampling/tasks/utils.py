import time
from typing import Optional

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


class Timer:
    """
    Simple timer class for investigating timeout issues with dynamic sampling tasks

    """

    def __init__(self):
        self.elapsed: float = 0
        self.started: Optional[float] = None

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()
        return False

    def start(self) -> float:
        if not self.started:
            self.started = time.monotonic()
        return self.current()

    def stop(self) -> float:
        if self.started:
            self.elapsed += time.monotonic() - self.started
        self.started = None
        return self.current()

    def current(self) -> float:
        if self.started:
            return self.elapsed + time.monotonic() - self.started
        return self.elapsed

    def reset(self) -> float:
        self.elapsed = 0
        self.started = None
        return 0

    def __str__(self) -> str:
        return str(self.current())

    def __repr__(self) -> str:
        return f"{self.current()}s"
