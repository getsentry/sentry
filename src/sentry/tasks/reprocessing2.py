import time
import logging

from django.db import transaction

from sentry import eventstore, eventstream, models, nodestore
from sentry.eventstore.models import Event
from sentry.utils.query import celery_run_batch_query
from sentry.tasks.base import instrumented_task, retry

GROUP_REPROCESSING_CHUNK_SIZE = 100

nodestore_stats_logger = logging.getLogger("sentry.nodestore.stats")


@instrumented_task(
    name="sentry.tasks.reprocessing2.reprocess_group",
    queue="events.reprocessing.process_event",
    time_limit=120,
    soft_time_limit=110,
)
def reprocess_group(
    project_id,
    group_id,
    remaining_events="delete",
    new_group_id=None,
    query_state=None,
    start_time=None,
    max_events=None,
    acting_user_id=None,
):
    from sentry.reprocessing2 import start_group_reprocessing

    if start_time is None:
        assert new_group_id is None
        start_time = time.time()
        new_group_id = start_group_reprocessing(
            project_id,
            group_id,
            max_events=max_events,
            acting_user_id=acting_user_id,
            remaining_events=remaining_events,
        )

    assert new_group_id is not None

    query_state, events = celery_run_batch_query(
        filter=eventstore.Filter(project_ids=[project_id], group_ids=[group_id]),
        batch_size=GROUP_REPROCESSING_CHUNK_SIZE,
        state=query_state,
        referrer="reprocessing2.reprocess_group",
    )

    if not events:
        return

    remaining_event_ids = []

    for event in events:
        if max_events is None or max_events > 0:
            reprocess_event.delay(
                project_id=project_id,
                event_id=event.event_id,
                start_time=start_time,
            )
            if max_events is not None:
                max_events -= 1
        else:
            remaining_event_ids.append(event.event_id)

    # len(remaining_event_ids) is upper-bounded by GROUP_REPROCESSING_CHUNK_SIZE
    if remaining_event_ids:
        handle_remaining_events.delay(
            project_id=project_id,
            new_group_id=new_group_id,
            event_ids=remaining_event_ids,
            remaining_events=remaining_events,
        )

    reprocess_group.delay(
        project_id=project_id,
        group_id=group_id,
        new_group_id=new_group_id,
        query_state=query_state,
        start_time=start_time,
        max_events=max_events,
        remaining_events=remaining_events,
    )


@instrumented_task(
    name="sentry.tasks.reprocessing2.handle_remaining_events",
    queue="events.reprocessing.process_event",
    time_limit=60 * 5,
    max_retries=5,
)
@retry
def handle_remaining_events(project_id, new_group_id, event_ids, remaining_events):
    """
    Delete or merge/move associated per-event data: nodestore, event
    attachments, user reports. Mark the event as "tombstoned" in Snuba.

    This is not full event deletion. Snuba can still only delete entire groups,
    however we must only run this task for event IDs that we don't intend to
    reuse for reprocessed events. An event ID that is once tombstoned cannot be
    inserted over in eventstream.

    See doccomment in sentry.reprocessing2.
    """

    assert remaining_events in ("delete", "keep")

    if remaining_events == "delete":
        models.EventAttachment.objects.filter(
            project_id=project_id, event_id__in=event_ids
        ).delete()
        models.UserReport.objects.filter(project_id=project_id, event_id__in=event_ids).delete()

        # Remove from nodestore
        node_ids = [Event.generate_node_id(project_id, event_id) for event_id in event_ids]
        nodestore.delete_multi(node_ids)

        # Tell Snuba to delete the event data.
        eventstream.tombstone_events_unsafe(project_id, event_ids)
    elif remaining_events == "keep":
        eventstream.replace_group_unsafe(project_id, event_ids, new_group_id=new_group_id)
    else:
        raise ValueError(f"Invalid value for remaining_events: {remaining_events}")


@instrumented_task(
    name="sentry.tasks.reprocessing2.reprocess_event",
    queue="events.reprocessing.process_event",
    time_limit=30,
    soft_time_limit=20,
)
def reprocess_event(project_id, event_id, start_time):
    from sentry.reprocessing2 import reprocess_event as reprocess_event_impl

    reprocess_event_impl(project_id=project_id, event_id=event_id, start_time=start_time)


@instrumented_task(
    name="sentry.tasks.reprocessing2.finish_reprocessing",
    queue="events.reprocessing.process_event",
    time_limit=(60 * 5) + 5,
    soft_time_limit=60 * 5,
)
def finish_reprocessing(project_id, group_id):
    from sentry.models import Group, GroupRedirect, Activity

    with transaction.atomic():
        group = Group.objects.get(id=group_id)

        # While we migrated all associated models at the beginning of
        # reprocessing, there is still the "reprocessing" activity that we need
        # to transfer manually.
        activity = Activity.objects.get(group_id=group_id)
        new_group_id = activity.group_id = activity.data["newGroupId"]
        activity.save()

        new_group = Group.objects.get(id=new_group_id)

        # Any sort of success message will be shown at the *new* group ID's URL
        GroupRedirect.objects.create(
            organization_id=new_group.project.organization_id,
            group_id=new_group_id,
            previous_group_id=group_id,
        )

        # All the associated models (groupassignee and eventattachments) should
        # have moved to a successor group that may be deleted independently.
        group.delete()

    # Need to delay this until we have enqueued all events.
    eventstream.exclude_groups(project_id, [group_id])

    from sentry import similarity

    similarity.delete(None, group)
