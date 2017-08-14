from __future__ import absolute_import, print_function

from django.db import models, transaction
from django.utils import timezone
from jsonfield import JSONField

from sentry.db.models import (BaseManager, Model, sane_repr)


class ScheduledJobManager(BaseManager):
    def schedule_job(self, payload, job):
        name, date_scheduled = job
        created_job = self.create(name=name, payload=payload, date_scheduled=date_scheduled)
        return created_job

    def bulk_schedule_jobs(self, payload, jobs):
        all_jobs = []

        for job in jobs:
            name, date_scheduled = job

            all_jobs.append(ScheduledJob(name=name, payload=payload, date_scheduled=date_scheduled))

        with transaction.atomic():
            self.bulk_create(all_jobs)
            return True


class ScheduledJob(Model):
    __core__ = False

    name = models.CharField(max_length=128)
    payload = JSONField()
    date_added = models.DateTimeField(default=timezone.now)
    date_scheduled = models.DateTimeField()

    objects = ScheduledJobManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_scheduledjob'

    __repr__ = sane_repr('name', 'date_scheduled')
