from __future__ import absolute_import

import time


from sentry import eventstore, eventstream
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
                end=to_datetime(start_time),
            ),
            limit=GROUP_REPROCESSING_CHUNK_SIZE,
            offset=offset,
        )
    )

    if not events:
        # XXX: wait for reprocessing to be done
        # XXX: Pass by filippo, is start_delete_groups even doing anything for snuba?
        eventstream_state = eventstream.start_delete_groups(project_id, [group_id])
        eventstream.end_delete_groups(eventstream_state, cutoff_datetime=to_datetime(start_time))
        return

    from sentry.reprocessing2 import reprocess_events

    reprocess_events(
        project_id=project_id, event_ids=[e.event_id for e in events], start_time=start_time,
    )

    reprocess_group.delay(
        project_id=project_id, group_id=group_id, offset=offset + len(events), start_time=start_time
    )
