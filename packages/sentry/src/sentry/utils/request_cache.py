import threading

from celery.signals import task_failure, task_success
from django.core.signals import request_finished

from sentry import app

_cache = threading.local()


def request_cache(func):
    """
    A decorator to memoize functions on a per-request basis.
    Arguments to the memoized function should NOT be objects
    Use primitive types as arguments
    """

    def wrapped(*args, **kwargs):
        # if no request, skip cache
        if app.env.request is None:
            return func(*args, **kwargs)

        if not hasattr(_cache, "items"):
            _cache.items = {}
        cache_key = (func, repr(args), repr(kwargs))
        if cache_key in _cache.items:
            rv = _cache.items[cache_key]
        else:
            rv = func(*args, **kwargs)
            _cache.items[cache_key] = rv
        return rv

    return wrapped


def clear_cache(**kwargs):
    _cache.items = {}


request_finished.connect(clear_cache)
task_failure.connect(clear_cache)
task_success.connect(clear_cache)
