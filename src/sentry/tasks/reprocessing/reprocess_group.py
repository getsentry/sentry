import time

import sentry_sdk
from django.conf import settings

from sentry import eventstore
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.query import celery_run_batch_query


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
                    logger.error(f"reprocessing2.{e}")
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
