"""
sentry.tasks.base
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import resource

from celery.task import current
from contextlib import contextmanager
from functools import wraps
from raven.contrib.django.models import client as Raven

from sentry.celery import app
from sentry.utils import metrics
from sentry.utils.performance import SqlQueryCountMonitor


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
            transaction_id = kwargs.pop('__transaction_id', None)

            key = 'jobs.duration'
            if stat_suffix:
                instance = '{}.{}'.format(name, stat_suffix(*args, **kwargs))
            else:
                instance = name
            Raven.tags_context({
                'task_name': name,
                'transaction_id': transaction_id,
            })
            with metrics.timer(key, instance=instance), \
                    track_memory_usage('jobs.memory_change', instance=instance), \
                    SqlQueryCountMonitor(name):
                try:
                    result = func(*args, **kwargs)
                finally:
                    Raven.context.clear()
            return result
        return app.task(name=name, **kwargs)(_wrapped)
    return wrapped


def retry(func=None, on=(Exception, ), exclude=()):
    """
    >>> @retry(on=(Exception,), exclude=(AnotherException,))
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
            except exclude:
                raise
            except on as exc:
                Raven.captureException()
                current.retry(exc=exc)
        return wrapped
    return inner
