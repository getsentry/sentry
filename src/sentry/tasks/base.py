"""
sentry.tasks.base
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import resource
from contextlib import contextmanager
from functools import wraps

from celery.exceptions import SoftTimeLimitExceeded
from celery.task import current
from raven.contrib.django.models import client as Raven

from sentry.celery import app
from sentry.utils import metrics


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
            key = 'jobs.duration'
            if stat_suffix:
                instance = '{}.{}'.format(name, stat_suffix(*args, **kwargs))
            else:
                instance = name
            Raven.tags_context({'task_name': name})
            with metrics.timer(key, instance=instance), \
                    track_memory_usage('jobs.memory_change', instance=instance):
                try:
                    return func(*args, **kwargs)
                except SoftTimeLimitExceeded as error:
                    Raven.context.merge({
                        'fingerprint': [type(error).__name__, instance],
                    })
                    raise
                finally:
                    Raven.context.clear()
        return app.task(name=name, **kwargs)(_wrapped)
    return wrapped


def retry(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            current.retry(exc=exc)
    return wrapped
