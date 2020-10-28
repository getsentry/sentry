from __future__ import absolute_import, division

import logging

from django.utils import timezone

from sentry.app import locks
from sentry.models import ScheduledJob
from sentry.tasks.base import instrumented_task

logger = logging.getLogger("sentry.scheduler")


@instrumented_task(name="sentry.tasks.enqueue_scheduled_jobs")
def enqueue_scheduled_jobs(**kwargs):
    from sentry.celery import app

    with locks.get("scheduler.process", duration=60).acquire():
        job_list = list(ScheduledJob.objects.filter(date_scheduled__lte=timezone.now())[:101])

        if len(job_list) > 100:
            logger.debug("More than 100 ScheduledJobs found.")

        for job in job_list:
            logger.debug("Sending scheduled job %s with payload %r", job.name, job.payload)
            app.send_task(job.name, kwargs=job.payload)
            job.delete()
