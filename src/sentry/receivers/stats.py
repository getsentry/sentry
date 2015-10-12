from __future__ import absolute_import

from celery.signals import task_prerun, task_postrun, task_revoked, task_sent
from django.db.models.signals import post_save

from sentry.utils import metrics


def record_instance_creation(instance, created, **kwargs):
    if not created:
        return

    metrics.incr('objects.created', instance=instance._meta.db_table)

post_save.connect(
    record_instance_creation,
    weak=False,
    dispatch_uid='sentry.stats.tasks.record_instance_creation',
)


def _get_task_name(task):
    return task.name or '{0}.{1}'.format(task.__module__, task.__name__)


def record_task_signal(signal, name):
    def handler(task, **kwargs):
        if not isinstance(task, basestring):
            task = _get_task_name(task)
        metrics.incr('jobs.{0}'.format(name), instance=task)

    signal.connect(
        handler,
        weak=False,
        dispatch_uid='sentry.stats.tasks.{0}'.format(name),
    )


# https://celery.readthedocs.org/en/latest/userguide/signals.html#task-revoked
def task_revoked_handler(sender, expired=False, **kwargs):
    if expired:
        metrics.incr('jobs.expired', instance=sender)
    else:
        metrics.incr('jobs.revoked', instance=sender)


task_revoked.connect(
    task_revoked_handler,
    weak=False,
    dispatch_uid='sentry.stats.tasks.revoked',
)

record_task_signal(task_prerun, 'started')
record_task_signal(task_postrun, 'finished')
record_task_signal(task_sent, 'dispatched')
