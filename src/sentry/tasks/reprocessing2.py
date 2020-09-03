from __future__ import absolute_import

import time

from sentry import eventstore
from sentry.utils.dates import to_datetime

from sentry.tasks.base import instrumented_task

GROUP_REPROCESSING_CHUNK_SIZE = 100


@instrumented_task(
    name="sentry.tasks.reprocessing2.reprocess_group",
    queue="events.reprocessing.preprocess_event",  # XXX: dedicated queue
    time_limit=120,
    soft_time_limit=110,
)
def reprocess_group(project_id, group_id, offset=0, start_time=None):
    if start_time is None:
        start_time = time.time()

    events = list(
        eventstore.get_unfetched_events(
            eventstore.Filter(
                project_ids=[project_id],
                group_ids=[group_id],
                # XXX: received?
                conditions=[["timestamp", "<", to_datetime(start_time)]],
            ),
            limit=GROUP_REPROCESSING_CHUNK_SIZE,
            offset=offset,
            referrer="reprocessing2.reprocess_group",
        )
    )

    if not events:
        return

    for event in events:
        reprocess_event.delay(
            project_id=project_id, event_id=event.event_id, start_time=start_time,
        )

    reprocess_group.delay(
        project_id=project_id, group_id=group_id, offset=offset + len(events), start_time=start_time
    )


@instrumented_task(
    name="sentry.tasks.reprocessing2.reprocess_event",
    queue="events.reprocessing.preprocess_event",  # XXX: dedicated queue
    time_limit=30,
    soft_time_limit=20,
)
def reprocess_event(project_id, event_id, start_time):
    from sentry.reprocessing2 import reprocess_event as reprocess_event_impl

    reprocess_event_impl(project_id=project_id, event_id=event_id, start_time=start_time)
