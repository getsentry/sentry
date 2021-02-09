from celery.signals import task_failure, task_prerun, task_sent, task_success
from django.db.models.signals import post_save

from sentry.utils import metrics


def record_instance_creation(instance, created, **kwargs):
    if not created:
        return

    metrics.incr("objects.created", instance=instance._meta.db_table, skip_internal=False)


post_save.connect(
    record_instance_creation, weak=False, dispatch_uid="sentry.stats.tasks.record_instance_creation"
)


def _get_task_name(task):
    return task.name or f"{task.__module__}.{task.__name__}"


def record_task_signal(signal, name, **options):
    def handler(sender, **kwargs):
        if not isinstance(sender, str):
            sender = _get_task_name(sender)
        options["skip_internal"] = options.get("skip_internal", False)
        metrics.incr(f"jobs.{name}", instance=sender, **options)
        metrics.incr(f"jobs.all.{name}", skip_internal=False)

    signal.connect(handler, weak=False, dispatch_uid=f"sentry.stats.tasks.{name}")


# TODO: https://github.com/getsentry/sentry/issues/2495
# https://celery.readthedocs.io/en/latest/userguide/signals.html#task-revoked
# def task_revoked_handler(sender, expired=False, **kwargs):
#     if expired:
#         metrics.incr('jobs.expired', instance=sender)
#     else:
#         metrics.incr('jobs.revoked', instance=sender)
#
#
# task_revoked.connect(
#     task_revoked_handler,
#     weak=False,
#     dispatch_uid='sentry.stats.tasks.revoked',
# )

record_task_signal(task_sent, "dispatched")
record_task_signal(task_prerun, "started")
record_task_signal(task_success, "finished", tags={"result": "success"})
record_task_signal(task_failure, "finished", tags={"result": "failure"})
