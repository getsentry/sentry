from sentry import eventstream, nodestore
from sentry.eventstore.models import Event
from sentry.tasks.base import instrumented_task, retry
from sentry.utils import metrics


@instrumented_task(
    name="sentry.tasks.reprocessing2.handle_remaining_events",
    queue="events.reprocessing.process_event",
    time_limit=60 * 5,
    max_retries=5,
)
@retry
def handle_remaining_events(
    project_id,
    new_group_id,
    remaining_events,
    # TODO(markus): Should be mandatory arguments.
    event_ids_redis_key=None,
    old_group_id=None,
    # TODO(markus): Deprecated arguments, can remove in next version.
    event_ids=None,
    from_timestamp=None,
    to_timestamp=None,
):
    """
    Delete or merge/move associated per-event data: nodestore, event
    attachments, user reports. Mark the event as "tombstoned" in Snuba.

    This is not full event deletion. Snuba can still only delete entire groups,
    however we must only run this task for event IDs that we don't intend to
    reuse for reprocessed events. An event ID that is once tombstoned cannot be
    inserted over in eventstream.

    See doc comment in sentry.reprocessing2.
    """

    from sentry import buffer
    from sentry.models.group import Group
    from sentry.reprocessing2 import EVENT_MODELS_TO_MIGRATE, pop_batched_events_from_redis

    if event_ids_redis_key is not None:
        event_ids, from_timestamp, to_timestamp = pop_batched_events_from_redis(event_ids_redis_key)

    metrics.timing(
        "events.reprocessing.handle_remaining_events.batch_size",
        len(event_ids),
        sample_rate=1.0,
    )

    assert remaining_events in ("delete", "keep")

    if remaining_events == "delete":
        for cls in EVENT_MODELS_TO_MIGRATE:
            cls.objects.filter(project_id=project_id, event_id__in=event_ids).delete()

        # Remove from nodestore
        node_ids = [Event.generate_node_id(project_id, event_id) for event_id in event_ids]
        nodestore.delete_multi(node_ids)

        # Tell Snuba to delete the event data.
        eventstream.tombstone_events_unsafe(
            project_id, event_ids, from_timestamp=from_timestamp, to_timestamp=to_timestamp
        )
    elif remaining_events == "keep":
        for cls in EVENT_MODELS_TO_MIGRATE:
            cls.objects.filter(project_id=project_id, event_id__in=event_ids).update(
                group_id=new_group_id
            )

        eventstream.replace_group_unsafe(
            project_id,
            event_ids,
            new_group_id=new_group_id,
            from_timestamp=from_timestamp,
            to_timestamp=to_timestamp,
        )

        buffer.incr(Group, {"times_seen": len(event_ids)}, {"id": new_group_id})
    else:
        raise ValueError(f"Invalid value for remaining_events: {remaining_events}")

    if old_group_id is not None:
        from sentry.reprocessing2 import mark_event_reprocessed

        mark_event_reprocessed(
            group_id=old_group_id, project_id=project_id, num_events=len(event_ids)
        )
