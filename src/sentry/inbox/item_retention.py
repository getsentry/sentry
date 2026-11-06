from django.db import router, transaction
from taskbroker_client.retry import Retry

from sentry import options
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.notifications.models.inboxitem import InboxItem
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import notifications_tasks

MAX_ITEMS_PER_INBOX = 2_000
ITEM_BATCH_SIZE = 50
SCHEDULE_BATCH_SIZE = 100


@instrumented_task(
    name="sentry.inbox.item_retention.schedule_inbox_item_cleanup",
    namespace=notifications_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=10, on=(Exception,)),
)
def schedule_inbox_item_cleanup(*, after_organization_id: int = 0, after_user_id: int = 0) -> None:
    if not options.get("cleanup.inbox-items.enabled"):
        return

    # Seek past each inbox instead of scanning all its items with DISTINCT.
    for _ in range(SCHEDULE_BATCH_SIZE):
        inbox = (
            InboxItem.objects.filter(status=ObjectStatus.ACTIVE)
            .extra(
                where=['ROW("organization_id", "user_id") > ROW(%s, %s)'],
                params=[after_organization_id, after_user_id],
            )
            .order_by("organization_id", "user_id")
            .values_list("organization_id", "user_id")
            .first()
        )
        if inbox is None:
            return
        after_organization_id, after_user_id = inbox
        cleanup_inbox_items.delay(organization_id=after_organization_id, user_id=after_user_id)
    schedule_inbox_item_cleanup.delay(
        after_organization_id=after_organization_id, after_user_id=after_user_id
    )


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
        # Recheck activity under lock; candidates may have received new events.
        candidates = list(
            items.filter(
                id__in=[item.id for item in overflow],
                last_activity_at__lte=overflow[0].last_activity_at,
            )
            .order_by("id")
            .select_for_update(skip_locked=True)
        )
        for item in candidates:
            item.update(status=ObjectStatus.PENDING_DELETION)
            CellScheduledDeletion.schedule(item, days=0)

    if candidates:
        cleanup_inbox_items.delay(organization_id=organization_id, user_id=user_id)
