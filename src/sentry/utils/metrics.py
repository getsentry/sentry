from __future__ import absolute_import

__all__ = ["timing", "incr"]

import logging

import functools
from contextlib import contextmanager
from django.conf import settings
from random import random
from time import time
from threading import Thread
from six.moves.queue import Queue


metrics_skip_all_internal = getattr(settings, "SENTRY_METRICS_SKIP_ALL_INTERNAL", False)
metrics_skip_internal_prefixes = tuple(settings.SENTRY_METRICS_SKIP_INTERNAL_PREFIXES)


def get_default_backend():
    from sentry.utils.imports import import_string

    cls = import_string(settings.SENTRY_METRICS_BACKEND)

    return cls(**settings.SENTRY_METRICS_OPTIONS)


backend = get_default_backend()


def _get_key(key):
    prefix = settings.SENTRY_METRICS_PREFIX
    if prefix:
        return u"{}{}".format(prefix, key)
    return key


def _should_sample(sample_rate):
    return sample_rate >= 1 or random() >= 1 - sample_rate


def _sampled_value(value, sample_rate):
    if sample_rate < 1:
        value = int(value * (1.0 / sample_rate))
    return value


class InternalMetrics(object):
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
                    full_key = u"{}.{}".format(key, instance)
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
    key,
    amount=1,
    instance=None,
    tags=None,
    skip_internal=True,
    sample_rate=settings.SENTRY_METRICS_SAMPLE_RATE,
):
    should_send_internal = (
        not metrics_skip_all_internal
        and not skip_internal
        and _should_sample(sample_rate)
        and not key.startswith(metrics_skip_internal_prefixes)
    )

    if should_send_internal:
        internal.incr(key, instance, tags, amount, sample_rate)

    try:
        backend.incr(key, instance, tags, amount, sample_rate)
        if should_send_internal:
            backend.incr("internal_metrics.incr", key, None, 1, sample_rate)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def timing(key, value, instance=None, tags=None, sample_rate=settings.SENTRY_METRICS_SAMPLE_RATE):
    try:
        backend.timing(key, value, instance, tags, sample_rate)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


@contextmanager
def timer(key, instance=None, tags=None, sample_rate=settings.SENTRY_METRICS_SAMPLE_RATE):
    if tags is None:
        tags = {}

    start = time()
    try:
        yield tags
    except Exception:
        tags["result"] = "failure"
        raise
    else:
        tags["result"] = "success"
    finally:
        timing(key, time() - start, instance, tags, sample_rate)


def wraps(key, instance=None, tags=None):
    def wrapper(f):
        @functools.wraps(f)
        def inner(*args, **kwargs):
            with timer(key, instance=instance, tags=tags):
                return f(*args, **kwargs)

        return inner

    return wrapper
