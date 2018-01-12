from __future__ import absolute_import, print_function

import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from sentry.tasks.base import instrumented_task
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)


@instrumented_task(name='sentry.tasks.reprocess_events', queue='events.reprocess_events')
def reprocess_events(project_id, **kwargs):
    from sentry.models import ProcessingIssue
    from sentry.coreapi import ClientApiHelper
    from sentry import app

    lock_key = 'events:reprocess_events:%s' % project_id
    have_more = False
    lock = app.locks.get(lock_key, duration=60)

    try:
        with lock.acquire():
            raw_events, have_more = ProcessingIssue.objects \
                .find_resolved(project_id)
            if raw_events:
                helper = ClientApiHelper()
                for raw_event in raw_events:
                    helper.insert_data_to_database(raw_event.data.data, from_reprocessing=True)
                    create_reprocessing_report(project_id=project_id, event_id=raw_event.event_id)
                    # Here we only delete the raw event but leave the
                    # reprocessing report alive.  When the queue
                    # eventually kicks in this should clean up.
                    raw_event.delete()
    except UnableToAcquireLock as error:
        logger.warning('reprocess_events.fail', extra={'error': error})

    # There are more, kick us off again
    if have_more:
        reprocess_events.delay(project_id=project_id)


def create_reprocessing_report(project_id, event_id):
    from sentry.models import ReprocessingReport
    return ReprocessingReport.objects.create(project_id=project_id, event_id=event_id)


@instrumented_task(name='sentry.tasks.clear_expired_raw_events', time_limit=15, soft_time_limit=10)
def clear_expired_raw_events():
    from sentry.models import RawEvent, ProcessingIssue, ReprocessingReport

    cutoff = timezone.now() - \
        timedelta(days=settings.SENTRY_RAW_EVENT_MAX_AGE_DAYS)

    # Clear old raw events and reprocessing reports
    RawEvent.objects.filter(datetime__lt=cutoff).delete()
    ReprocessingReport.objects.filter(datetime__lt=cutoff).delete()

    # Processing issues get a bit of extra time before we delete them
    cutoff = timezone.now() - timedelta(days=int(settings.SENTRY_RAW_EVENT_MAX_AGE_DAYS * 1.3))
    ProcessingIssue.objects.filter(datetime__lt=cutoff).delete()
