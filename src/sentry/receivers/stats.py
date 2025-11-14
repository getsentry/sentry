from typing import int
from django.db.models.signals import post_save

from sentry.utils import metrics


def record_instance_creation(instance, created, **kwargs):
    if not created:
        return

    metrics.incr("objects.created", instance=instance._meta.db_table, skip_internal=False)


post_save.connect(
    record_instance_creation, weak=False, dispatch_uid="sentry.stats.tasks.record_instance_creation"
)
