from __future__ import absolute_import

import time

from sentry import eventstore

from sentry.tasks.base import instrumented_task

GROUP_REPROCESSING_CHUNK_SIZE = 100


@instrumented_task(
    name="sentry.tasks.reprocessing2.reprocess_group",
    queue="events.reprocessing.preprocess_event",  # XXX: dedicated queue
    time_limit=120,
    soft_time_limit=110,
)
def reprocess_group(
    project_id, group_id, offset=0, start_time=None, max_events=None, acting_user_id=None
):
    from sentry.reprocessing2 import start_group_reprocessing

    if start_time is None:
        start_time = time.time()
        start_group_reprocessing(
            project_id, group_id, max_events=max_events, acting_user_id=acting_user_id
        )

    if max_events is not None and max_events <= 0:
        events = []
    else:
        limit = GROUP_REPROCESSING_CHUNK_SIZE

        if max_events is not None:
            limit = min(limit, max_events)

        events = list(
            eventstore.get_unfetched_events(
                eventstore.Filter(project_ids=[project_id], group_ids=[group_id],),
                limit=limit,
                orderby=["-timestamp"],
                offset=offset,
                referrer="reprocessing2.reprocess_group",
            )
        )

    if not events:
        wait_group_reprocessed.delay(project_id=project_id, group_id=group_id)
        return

    for event in events:
        reprocess_event.delay(
            project_id=project_id, event_id=event.event_id, start_time=start_time,
        )

    if max_events is not None:
        max_events -= len(events)

    reprocess_group.delay(
        project_id=project_id,
        group_id=group_id,
        offset=offset + len(events),
        start_time=start_time,
        max_events=max_events,
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


@instrumented_task(
    name="sentry.tasks.reprocessing2.wait_group_reprocessed",
    queue="sleep",
    time_limit=(60 * 5) + 5,
    soft_time_limit=60 * 5,
)
def wait_group_reprocessed(project_id, group_id):
    from sentry.reprocessing2 import is_group_finished

    if is_group_finished(group_id):
        delete_old_group.delay(project_id=project_id, group_id=group_id)
    else:
        wait_group_reprocessed.apply_async(
            kwargs={"project_id": project_id, "group_id": group_id}, countdown=60 * 5
        )


@instrumented_task(
    name="sentry.tasks.reprocessing2.delete_old_group",
    queue="events.reprocessing.preprocess_event",
    time_limit=(60 * 5) + 5,
    soft_time_limit=60 * 5,
)
def delete_old_group(project_id, group_id):
    from sentry.models.group import Group
    from sentry.group_deletion import delete_group

    group = Group.objects.get_from_cache(id=group_id)

    delete_group(group)
