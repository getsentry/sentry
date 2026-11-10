from taskbroker_client.retry import Retry

from sentry import options
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import notifications_tasks
from sentry.utils.query import bulk_delete_objects

MAX_EVENTS_PER_ITEM = 100
DELETE_BATCH_SIZE = 1_000
SCHEDULE_BATCH_SIZE = 100


@instrumented_task(
    name="sentry.inbox.event_retention.schedule_inbox_event_cleanup",
    namespace=notifications_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=10, on=(Exception,)),
)
def schedule_inbox_event_cleanup(*, after_item_id: int = 0) -> None:
    if not options.get("cleanup.inbox-events.enabled"):
        return

    item_ids = list(
        InboxItem.objects.filter(id__gt=after_item_id)
        .order_by("id")
        .values_list("id", flat=True)[:SCHEDULE_BATCH_SIZE]
    )
    for item_id in item_ids:
        cleanup_inbox_item_events.delay(item_id=item_id)
    if len(item_ids) == SCHEDULE_BATCH_SIZE:
        schedule_inbox_event_cleanup.delay(after_item_id=item_ids[-1])


@instrumented_task(
    name="sentry.inbox.event_retention.cleanup_inbox_item_events",
    namespace=notifications_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=10, on=(Exception,)),
)
def cleanup_inbox_item_events(*, item_id: int) -> None:
    if not options.get("cleanup.inbox-events.enabled"):
        return

    event_ids = list(
        InboxItemEvent.objects.filter(inbox_item_id=item_id)
        .order_by("-date_added", "-id")
        .values_list("id", flat=True)[MAX_EVENTS_PER_ITEM : MAX_EVENTS_PER_ITEM + DELETE_BATCH_SIZE]
    )
    bulk_delete_objects(model=InboxItemEvent, limit=DELETE_BATCH_SIZE, id__in=event_ids)
    if len(event_ids) == DELETE_BATCH_SIZE:
        cleanup_inbox_item_events.delay(item_id=item_id)
