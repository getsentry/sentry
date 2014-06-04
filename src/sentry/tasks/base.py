"""
sentry.tasks.base
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task
from django_statsd.clients import statsd
from functools import wraps


def instrumented_task(name, stat_suffix=None, **kwargs):
    def wrapped(func):
        @wraps(func)
        def _wrapped(*args, **kwargs):
            statsd_key = 'jobs.duration.{name}'.format(name=name)
            if stat_suffix:
                statsd_key += '.{key}'.format(key=stat_suffix(*args, **kwargs))
            with statsd.timer(statsd_key):
                result = func(*args, **kwargs)
            return result
        return task(name=name, **kwargs)(_wrapped)
    return wrapped
