from datetime import timedelta

from django.db import router, transaction
from django.db.models import Exists, OuterRef
from taskbroker_client.retry import Retry

from sentry import options
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import notifications_tasks
from sentry.utils.cursored_scheduler import CursoredScheduler

MAX_ITEMS_PER_INBOX = 2_000
ITEM_BATCH_SIZE = 50
SCHEDULE_BATCH_SIZE = 100
# Retention controls long-term growth; spread one sweep across each day.
CYCLE_DURATION = timedelta(days=1)


@instrumented_task(
    name="sentry.inbox.item_retention.schedule_inbox_item_cleanup",
    namespace=notifications_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=10, on=(Exception,)),
)
def schedule_inbox_item_cleanup() -> None:
    if not options.get("cleanup.inbox-items.enabled"):
        return

    CursoredScheduler(
        name="inbox_item_cleanup",
        schedule_key="cleanup-universal-inbox-items",
        queryset=Organization.objects.filter(
            Exists(
                InboxItem.objects.filter(organization_id=OuterRef("pk"), status=ObjectStatus.ACTIVE)
            )
        ),
        task=schedule_organization_inbox_item_cleanup,
        cycle_duration=CYCLE_DURATION,
    ).tick()


@instrumented_task(
    name="sentry.inbox.item_retention.schedule_organization_inbox_item_cleanup",
    namespace=notifications_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=10, on=(Exception,)),
)
def schedule_organization_inbox_item_cleanup(
    organization_id: int, *, after_user_id: int = 0
) -> None:
    if not options.get("cleanup.inbox-items.enabled"):
        return

    # Seek past each inbox instead of scanning all its items with DISTINCT.
    for _ in range(SCHEDULE_BATCH_SIZE):
        user_id = (
            InboxItem.objects.filter(
                organization_id=organization_id,
                status=ObjectStatus.ACTIVE,
                user_id__gt=after_user_id,
            )
            .order_by("user_id")
            .values_list("user_id", flat=True)
            .first()
        )
        if user_id is None:
            return
        after_user_id = user_id
        cleanup_inbox_items.delay(organization_id=organization_id, user_id=user_id)
    schedule_organization_inbox_item_cleanup.delay(organization_id, after_user_id=after_user_id)


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
