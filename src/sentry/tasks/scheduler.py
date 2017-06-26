from __future__ import absolute_import, division

import logging

from django.utils import timezone

from sentry.app import locks
from sentry.models import ScheduledJob
from sentry.tasks.base import instrumented_task

logger = logging.getLogger('sentry.scheduler')


@instrumented_task(name='sentry.tasks.enqueue_scheduled_jobs')
def enqueue_scheduled_jobs(**kwargs):
    from sentry.celery import app

    with locks.get('scheduler.process', duration=60).acquire():
        queryset = ScheduledJob.objects.filter(
            date_scheduled__lte=timezone.now(),
        )
        job_count = queryset.count()
        if job_count > 100:
            logger.debug('More than 100 ScheduledJob\'s: %d jobs found.' % job_count)

        for job in queryset.all()[:100]:
            logger.debug('Sending scheduled job %s with payload %r',
                        job.name, job.payload)
            app.send_task(job.name, kwargs=job.payload)
            job.delete()
