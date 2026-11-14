from django.db import router, transaction
from taskbroker_client.retry import Retry

from sentry import deletions, options
from sentry.constants import ObjectStatus
from sentry.notifications.models.inboxitem import InboxItem
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import notifications_tasks

MAX_ITEMS_PER_INBOX = 2_000
ITEM_BATCH_SIZE = 50


@instrumented_task(
    name="sentry.inbox.item_retention.cleanup_inbox_items",
    namespace=notifications_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=10, on=(Exception,)),
)
def cleanup_inbox_items(*, organization_id: int, user_id: int) -> None:
    if not options.get("cleanup.inbox-items.enabled"):
        return

    items = InboxItem.objects.filter(
        organization_id=organization_id, user_id=user_id, status=ObjectStatus.ACTIVE
    )
    overflow = list(
        items.order_by("-last_activity_at", "-id")[
            MAX_ITEMS_PER_INBOX : MAX_ITEMS_PER_INBOX + ITEM_BATCH_SIZE
        ]
    )
    if not overflow:
        return

    with transaction.atomic(using=router.db_for_write(InboxItem)):
        # Hold the item lock through deletion to serialize it with event recording.
        candidates = list(
            items.filter(
                id__in=[item.id for item in overflow],
                last_activity_at__lte=overflow[0].last_activity_at,
            )
            .order_by("id")
            .select_for_update(skip_locked=True)
        )
        deletions.exec_sync_many(candidates)

    if candidates:
        cleanup_inbox_items.delay(organization_id=organization_id, user_id=user_id)
