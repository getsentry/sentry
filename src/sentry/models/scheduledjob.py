from django.db import models
from django.utils import timezone

from sentry.db.models import JSONField, Model, control_silo_with_replication_model, sane_repr


def schedule_jobs(jobs):
    ScheduledJob.objects.bulk_create(
        [
            ScheduledJob(payload=payload, name=name, date_scheduled=date_scheduled)
            for (payload, name, date_scheduled) in jobs
        ]
    )
    return True


@control_silo_with_replication_model
class ScheduledJob(Model):
    __include_in_export__ = False

    name = models.CharField(max_length=128)
    payload = JSONField()
    date_added = models.DateTimeField(default=timezone.now)
    date_scheduled = models.DateTimeField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_scheduledjob"

    __repr__ = sane_repr("name", "date_scheduled")
