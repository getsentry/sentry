import time

import sentry_sdk
from django.conf import settings
from django.db import router, transaction

from sentry import eventstore, eventstream, nodestore
from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.reprocessing2 import buffered_delete_old_primary_hash
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.process_buffer import buffer_incr
from sentry.types.activity import ActivityType
from sentry.utils import metrics
from sentry.utils.query import celery_run_batch_query


@instrumented_task(
    name="sentry.tasks.reprocessing2.reprocess_group",
    queue="events.reprocessing.process_event",
    time_limit=120,
    soft_time_limit=110,
    silo_mode=SiloMode.REGION,
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
    sentry_sdk.set_tag("group_id", group_id)

    from sentry.reprocessing2 import (
        CannotReprocess,
        buffered_handle_remaining_events,
        logger,
        reprocess_event,
        start_group_reprocessing,
    )

    sentry_sdk.set_tag("is_start", "false")

    # Only executed once during reprocessing
    if start_time is None:
        assert new_group_id is None
        start_time = time.time()
        metrics.incr("events.reprocessing.start_group_reprocessing", sample_rate=1.0)
        sentry_sdk.set_tag("is_start", "true")
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
        batch_size=settings.SENTRY_REPROCESSING_PAGE_SIZE,
        state=query_state,
        referrer="reprocessing2.reprocess_group",
        tenant_ids={
            "organization_id": Project.objects.get_from_cache(id=project_id).organization_id
        },
    )

    if not events:
        # Migrate events that belong to new group generated after reprocessing
        buffered_handle_remaining_events(
            project_id=project_id,
            old_group_id=group_id,
            new_group_id=new_group_id,
            datetime_to_event=[],
            remaining_events=remaining_events,
            force_flush_batch=True,
        )

        return

    remaining_event_ids = []

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
                    logger.error("reprocessing2.%s", e)
                except Exception:
                    sentry_sdk.capture_exception()
                else:
                    if max_events is not None:
                        max_events -= 1

                    continue

        # In case of errors while kicking off reprocessing or if max_events has
        # been exceeded, do the default action.

        remaining_event_ids.append((event.datetime, event.event_id))

    # len(remaining_event_ids) is upper-bounded by settings.SENTRY_REPROCESSING_PAGE_SIZE
    if remaining_event_ids:
        buffered_handle_remaining_events(
            project_id=project_id,
            old_group_id=group_id,
            new_group_id=new_group_id,
            datetime_to_event=remaining_event_ids,
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
    silo_mode=SiloMode.REGION,
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
    sentry_sdk.set_tag("project", project_id)
    sentry_sdk.set_tag("old_group_id", old_group_id)
    sentry_sdk.set_tag("new_group_id", new_group_id)

    from sentry.models.group import Group
    from sentry.reprocessing2 import EVENT_MODELS_TO_MIGRATE, pop_batched_events_from_redis

    if event_ids_redis_key is not None:
        event_ids, from_timestamp, to_timestamp = pop_batched_events_from_redis(event_ids_redis_key)

    metrics.distribution(
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

        buffer_incr(Group, {"times_seen": len(event_ids)}, {"id": new_group_id})
    else:
        raise ValueError(f"Invalid value for remaining_events: {remaining_events}")

    if old_group_id is not None:
        from sentry.reprocessing2 import mark_event_reprocessed

        mark_event_reprocessed(
            group_id=old_group_id, project_id=project_id, num_events=len(event_ids)
        )


@instrumented_task(
    name="sentry.tasks.reprocessing2.finish_reprocessing",
    queue="events.reprocessing.process_event",
    time_limit=(60 * 5) + 5,
    soft_time_limit=60 * 5,
)
def finish_reprocessing(project_id, group_id):
    from sentry.models.activity import Activity
    from sentry.models.group import Group
    from sentry.models.groupredirect import GroupRedirect

    with transaction.atomic(router.db_for_write(Group)):
        group = Group.objects.get(id=group_id)

        # While we migrated all associated models at the beginning of
        # reprocessing, there is still the "reprocessing" activity that we need
        # to transfer manually.
        # Any activities created during reprocessing (e.g. user clicks "assign" in an old browser tab)
        # are ignored.
        activity = Activity.objects.get(group_id=group_id, type=ActivityType.REPROCESS.value)
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

    # Tombstone unwanted events that should be dropped after new group
    # is generated after reprocessing
    buffered_delete_old_primary_hash(
        project_id=project_id,
        group_id=group_id,
        force_flush_batch=True,
    )

    eventstream.exclude_groups(project_id, [group_id])

    from sentry import similarity

    similarity.delete(None, group)
