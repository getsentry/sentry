from __future__ import absolute_import

from sentry import eventstore
from sentry.models import Group

from sentry.tasks.base import instrumented_task

GROUP_REPROCESSING_CHUNK_SIZE = 100


@instrumented_task(
    name="sentry.tasks.reprocessing2.reprocess_group",
    queue="events.reprocessing.preprocess_event",
    time_limit=120,
    soft_time_limit=110,
)
def reprocess_group(project_id, group_id, offset=0):
    events = list(
        eventstore.get_unfetched_events(
            eventstore.Filter(project_ids=[project_id], group_ids=[group_id]),
            limit=GROUP_REPROCESSING_CHUNK_SIZE,
            offset=offset,
        )
    )

    if not events:
        from sentry.groupdeletion import delete_group

        delete_group(Group.objects.get_from_cache(id=group_id))
        return

    from sentry.reprocessing2 import reprocess_events

    reprocess_events(project_id, [e.event_id for e in events])

    reprocess_group.delay(project_id=project_id, group_id=group_id, offset=offset + len(events))
