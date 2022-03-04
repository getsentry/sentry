import logging

from sentry.tasks.base import instrumented_task
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)


def create_reprocessing_report(project_id, event_id):
    from sentry.models import ReprocessingReport

    return ReprocessingReport.objects.create(project_id=project_id, event_id=event_id)


@instrumented_task(name="sentry.tasks.reprocess_events", queue="events.reprocess_events")
def reprocess_events(project_id, **kwargs):
    from sentry import app
    from sentry.coreapi import insert_data_to_database_legacy
    from sentry.models import ProcessingIssue

    lock_key = "events:reprocess_events:%s" % project_id
    have_more = False
    lock = app.locks.get(lock_key, duration=60)

    try:
        with lock.acquire():
            raw_events, have_more = ProcessingIssue.objects.find_resolved(project_id)
            if raw_events:
                for raw_event in raw_events:
                    insert_data_to_database_legacy(raw_event.data.data, from_reprocessing=True)
                    create_reprocessing_report(project_id=project_id, event_id=raw_event.event_id)
                    # Here we only delete the raw event but leave the
                    # reprocessing report alive.  When the queue
                    # eventually kicks in this should clean up.
                    raw_event.delete()
    except UnableToAcquireLock as error:
        logger.warning("reprocess_events.fail", extra={"error": error})

    # There are more, kick us off again
    if have_more:
        reprocess_events.delay(project_id=project_id)
