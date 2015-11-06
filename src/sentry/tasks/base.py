"""
sentry.tasks.base
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from celery.task import current
from raven.contrib.django.models import client as Raven
from functools import wraps

from sentry.celery import app
from sentry.utils import metrics


def instrumented_task(name, stat_suffix=None, **kwargs):
    def wrapped(func):
        @wraps(func)
        def _wrapped(*args, **kwargs):
            key = 'jobs.duration'
            if stat_suffix:
                instance = '{}.{}'.format(name, stat_suffix(*args, **kwargs))
            else:
                instance = name
            with metrics.timer(key, instance=instance):
                try:
                    result = func(*args, **kwargs)
                finally:
                    Raven.context.clear()
            return result
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
