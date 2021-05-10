import logging
import time

import sentry_sdk
from django.db import transaction

from sentry import eventstore, eventstream, models, nodestore
from sentry.eventstore.models import Event
from sentry.tasks.base import instrumented_task, retry
from sentry.utils.query import celery_run_batch_query

# We have observed that the p95 of process_event is around 10s (p50 = 400ms),
# so we need to make sure that the amount of events we process in
# reprocess_group stays within its time_limit and soft_time_limit
#
# chunk_size         soft_time_limit
# 10         * 10 <= 110
GROUP_REPROCESSING_CHUNK_SIZE = 10

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
    sentry_sdk.set_tag("project", project_id)
    from sentry.reprocessing2 import (
        CannotReprocess,
        logger,
        reprocess_event,
        start_group_reprocessing,
    )

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
        # Need to delay this until we have enqueued all events and stopped
        # iterating over the batch query, if we take care of this in
        # finish_reprocessing it won't work, as for small max_events
        # finish_reprocessing may execute sooner than the last reprocess_group
        # iteration.
        eventstream.exclude_groups(project_id, [group_id])
        return

    remaining_event_ids = []
    remaining_events_min_datetime = None
    remaining_events_max_datetime = None

    for event in events:
        if max_events is None or max_events > 0:
            with sentry_sdk.start_span(op="reprocess_event"):
                try:
                    reprocess_event(
                        project_id=project_id,
                        event_id=event.event_id,
                        start_time=start_time,
                    )
                except CannotReprocess as e:
                    logger.error(f"reprocessing2.{e}")
                except Exception:
                    sentry_sdk.capture_exception()
                else:
                    if max_events is not None:
                        max_events -= 1

                    continue

        if remaining_events_min_datetime is None or remaining_events_min_datetime > event.datetime:
            remaining_events_min_datetime = event.datetime
        if remaining_events_max_datetime is None or remaining_events_max_datetime < event.datetime:
            remaining_events_max_datetime = event.datetime

        # In case of errors while kicking of reprocessing or if max_events has
        # been exceeded, do the default action.
        remaining_event_ids.append(event.event_id)

    # len(remaining_event_ids) is upper-bounded by GROUP_REPROCESSING_CHUNK_SIZE
    if remaining_event_ids:
        handle_remaining_events.delay(
            project_id=project_id,
            new_group_id=new_group_id,
            event_ids=remaining_event_ids,
            remaining_events=remaining_events,
            from_timestamp=remaining_events_min_datetime,
            to_timestamp=remaining_events_max_datetime,
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
def handle_remaining_events(
    project_id, new_group_id, event_ids, remaining_events, from_timestamp, to_timestamp
):
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
        eventstream.tombstone_events_unsafe(
            project_id, event_ids, from_timestamp=from_timestamp, to_timestamp=to_timestamp
        )
    elif remaining_events == "keep":
        eventstream.replace_group_unsafe(
            project_id,
            event_ids,
            new_group_id=new_group_id,
            from_timestamp=from_timestamp,
            to_timestamp=to_timestamp,
        )
    else:
        raise ValueError(f"Invalid value for remaining_events: {remaining_events}")


@instrumented_task(
    name="sentry.tasks.reprocessing2.finish_reprocessing",
    queue="events.reprocessing.process_event",
    time_limit=(60 * 5) + 5,
    soft_time_limit=60 * 5,
)
def finish_reprocessing(project_id, group_id):
    from sentry.models import Activity, Group, GroupRedirect

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

    from sentry import similarity

    similarity.delete(None, group)
