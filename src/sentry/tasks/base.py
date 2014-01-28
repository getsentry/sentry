"""
sentry.tasks.base
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task
from django_statsd.clients import statsd
from functools import wraps


def instrumented_task(name, queue, stat_suffix=None, **kwargs):
    statsd_key = 'tasks.{name}'.format(name=name)
    if stat_suffix:
        statsd_key += '.{key}'.format(key=stat_suffix)

    def wrapped(func):
        @wraps(func)
        def _wrapped(*args, **kwargs):
            with statsd.timer(statsd_key):
                return func(*args, **kwargs)
        return task(name=name, queue=queue, **kwargs)(func)
    return wrapped
