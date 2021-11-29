__all__ = ["timing", "incr"]


import functools
import logging
import time
from contextlib import contextmanager
from queue import Queue
from random import random
from threading import Thread, local
from typing import Mapping, Optional

from django.conf import settings

metrics_skip_all_internal = getattr(settings, "SENTRY_METRICS_SKIP_ALL_INTERNAL", False)
metrics_skip_internal_prefixes = tuple(settings.SENTRY_METRICS_SKIP_INTERNAL_PREFIXES)

_THREAD_LOCAL_TAGS = local()
_GLOBAL_TAGS = []


@contextmanager
def global_tags(_all_threads=False, **tags):
    if _all_threads:
        stack = _GLOBAL_TAGS
    else:
        if not hasattr(_THREAD_LOCAL_TAGS, "stack"):
            stack = _THREAD_LOCAL_TAGS.stack = []
        else:
            stack = _THREAD_LOCAL_TAGS.stack

    stack.append(tags)
    try:
        yield
    finally:
        stack.pop()


def _get_current_global_tags():
    rv = {}

    for tags in _GLOBAL_TAGS:
        rv.update(tags)

    for tags in getattr(_THREAD_LOCAL_TAGS, "stack", None) or ():
        rv.update(tags)

    return rv


def get_default_backend():
    from sentry.utils.imports import import_string

    cls = import_string(settings.SENTRY_METRICS_BACKEND)

    return cls(**settings.SENTRY_METRICS_OPTIONS)


backend = get_default_backend()


def _get_key(key):
    prefix = settings.SENTRY_METRICS_PREFIX
    if prefix:
        return f"{prefix}{key}"
    return key


def _should_sample(sample_rate):
    return sample_rate >= 1 or random() >= 1 - sample_rate


def _sampled_value(value, sample_rate):
    if sample_rate < 1:
        value = int(value * (1.0 / sample_rate))
    return value


class InternalMetrics:
    def __init__(self):
        self._started = False

    def _start(self):
        self.q = q = Queue()

        def worker():
            from sentry import tsdb

            while True:
                key, instance, tags, amount, sample_rate = q.get()
                amount = _sampled_value(amount, sample_rate)
                if instance:
                    full_key = f"{key}.{instance}"
                else:
                    full_key = key
                try:
                    tsdb.incr(tsdb.models.internal, full_key, count=amount)
                except Exception:
                    logger = logging.getLogger("sentry.errors")
                    logger.exception("Unable to incr internal metric")
                finally:
                    q.task_done()

        t = Thread(target=worker)
        t.setDaemon(True)
        t.start()

        self._started = True

    def incr(
        self,
        key,
        instance=None,
        tags=None,
        amount=1,
        sample_rate=settings.SENTRY_METRICS_SAMPLE_RATE,
    ):
        if not self._started:
            self._start()
        self.q.put((key, instance, tags, amount, sample_rate))


internal = InternalMetrics()


def incr(
    key: str,
    amount: int = 1,
    instance: Optional[str] = None,
    tags: Optional[Mapping[str, str]] = None,
    skip_internal: bool = True,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
) -> None:
    current_tags = _get_current_global_tags()
    if tags is not None:
        current_tags.update(tags)

    should_send_internal = (
        not metrics_skip_all_internal
        and not skip_internal
        and _should_sample(sample_rate)
        and not key.startswith(metrics_skip_internal_prefixes)
    )

    if should_send_internal:
        internal.incr(key, instance, current_tags, amount, sample_rate)

    try:
        backend.incr(key, instance, current_tags, amount, sample_rate)
        if should_send_internal:
            backend.incr("internal_metrics.incr", key, None, 1, sample_rate)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def gauge(
    key: str,
    value,
    instance: Optional[str] = None,
    tags: Optional[Mapping[str, str]] = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
) -> None:
    current_tags = _get_current_global_tags()
    if tags is not None:
        current_tags.update(tags)

    try:
        backend.gauge(key, value, instance, current_tags, sample_rate)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def timing(key, value, instance=None, tags=None, sample_rate=settings.SENTRY_METRICS_SAMPLE_RATE):
    current_tags = _get_current_global_tags()
    if tags is not None:
        current_tags.update(tags)

    try:
        backend.timing(key, value, instance, current_tags, sample_rate)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


@contextmanager
def timer(key, instance=None, tags=None, sample_rate=settings.SENTRY_METRICS_SAMPLE_RATE):
    current_tags = _get_current_global_tags()
    if tags is not None:
        current_tags.update(tags)

    start = time.monotonic()
    try:
        yield current_tags
    except Exception:
        current_tags["result"] = "failure"
        raise
    else:
        current_tags["result"] = "success"
    finally:
        timing(key, time.monotonic() - start, instance, current_tags, sample_rate)


def wraps(key, instance=None, tags=None):
    def wrapper(f):
        @functools.wraps(f)
        def inner(*args, **kwargs):
            with timer(key, instance=instance, tags=tags):
                return f(*args, **kwargs)

        return inner

    return wrapper
