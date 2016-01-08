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
from uuid import uuid4

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


class InstrumentedTask(app.Task):
    # Add support for transaction ID
    def apply_async(self, args=None, kwargs=None, task_id=None, producer=None,
                    link=None, link_error=None, **options):
        if kwargs is None:
            kwargs = {}
        elif '__transaction_id' not in kwargs:
            kwargs['__transaction_id'] = uuid4().hex

        return super(InstrumentedTask, self).apply_async(
            args=args,
            kwargs=kwargs,
            task_id=task_id,
            producer=producer,
            link=link,
            link_error=link_error,
            **options
        )


def instrumented_task(name, stat_suffix=None, **kwargs):
    def wrapped(func):
        @wraps(func)
        def _wrapped(*args, **kwargs):
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
                    track_memory_usage('jobs.memory_change', instance=instance):
                try:
                    result = func(*args, **kwargs)
                finally:
                    Raven.context.clear()
            return result
        return app.task(name=name, base=InstrumentedTask, **kwargs)(_wrapped)
    return wrapped


def retry(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            current.retry(exc=exc)
    return wrapped
