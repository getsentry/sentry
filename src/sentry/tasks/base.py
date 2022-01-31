import resource
from contextlib import contextmanager
from functools import wraps

from celery.task import current

from sentry.celery import app
from sentry.utils import metrics
from sentry.utils.sdk import capture_exception, configure_scope


def get_rss_usage():
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss


@contextmanager
def track_memory_usage(metric, **kwargs):
    before = get_rss_usage()
    try:
        yield
    finally:
        metrics.timing(metric, get_rss_usage() - before, **kwargs)


def instrumented_task(name, stat_suffix=None, **kwargs):
    def wrapped(func):
        @wraps(func)
        def _wrapped(*args, **kwargs):
            # TODO(dcramer): we want to tag a transaction ID, but overriding
            # the base on app.task seems to cause problems w/ Celery internals
            transaction_id = kwargs.pop("__transaction_id", None)

            key = "jobs.duration"
            if stat_suffix:
                instance = f"{name}.{stat_suffix(*args, **kwargs)}"
            else:
                instance = name

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
        return app.task(name=name, **kwargs)(_wrapped)

    return wrapped


def retry(func=None, on=(Exception,), exclude=(), ignore=()):
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
                current.retry(exc=exc)

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
