
from __future__ import absolute_import, division

import logging

from django.utils import timezone

from sentry.models import ScheduledJob
from sentry.tasks.base import instrumented_task
from sentry.utils.cache import Lock, UnableToGetLock

logger = logging.getLogger('sentry')


@instrumented_task(name='sentry.tasks.enqueue_scheduled_jobs')
def enqueue_scheduled_jobs(**kwargs):
    from sentry.celery import app

    lock_key = 'scheduler:process'
    try:
        with Lock(lock_key, nowait=True, timeout=60):
            queryset = list(ScheduledJob.objects.filter(
                date_scheduled__lte=timezone.now(),
            )[:100])

            for job in queryset:
                logger.info('Sending scheduled job %s with payload %r',
                            job.name, job.payload)
                app.send_task(job.name, kwargs=job.payload)

            ScheduledJob.objects.filter(
                id__in=[o.id for o in queryset],
            ).delete()
    except UnableToGetLock:
        logger.error('Failed to get scheduler lock', exc_info=True)
