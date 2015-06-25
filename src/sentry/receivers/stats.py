from __future__ import absolute_import

from celery.signals import task_prerun, task_postrun, task_sent
from django.db.models.signals import post_save

from sentry.utils import metrics


def record_instance_creation(instance, created, **kwargs):
    if not created:
        return

    metrics.incr('objects.created.all')
    metrics.incr('objects.created.types.{0}'.format(instance._meta.db_table))

post_save.connect(
    record_instance_creation,
    weak=False,
    dispatch_uid='record_instance_creation',
)


def _get_task_name(task):
    return task.name or '{0}.{1}'.format(task.__module__, task.__name__)


def record_task_signal(signal, name):
    def handler(task, **kwargs):
        if not isinstance(task, basestring):
            task = _get_task_name(task)
        metrics.incr('jobs.{0}.{1}'.format(name, task))
        metrics.incr('jobs.all.{0}'.format(name))

    signal.connect(
        handler,
        weak=False,
        dispatch_uid='sentry.stats.{0}'.format(name),
    )


record_task_signal(task_sent, 'dispatched')
record_task_signal(task_prerun, 'started')
record_task_signal(task_postrun, 'finished')
