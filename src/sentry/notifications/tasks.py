from datetime import timedelta

from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import deletion_tasks

RETENTION_DAYS = 90
BATCH_SIZE = 1000
MAX_BATCHES = 100


@instrumented_task(
    name="sentry.notifications.tasks.delete_old_notification_messages",
    namespace=deletion_tasks,
    processing_deadline_duration=10 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.CELL,
)
def delete_old_notification_messages() -> None:
    """
    Scheduled task that deletes NotificationMessage rows older than the
    retention window. Runs in batches so cascade handling stays bounded and
    we can stop cleanly when the per-run budget is exhausted.
    """
    cutoff = timezone.now() - timedelta(days=RETENTION_DAYS)

    # Skip parents whose children are still within the retention window so
    # cascade deletion doesn't silently remove in-retention thread replies.
    in_retention_parent_ids = NotificationMessage.objects.filter(
        date_added__gte=cutoff,
        parent_notification_message__isnull=False,
    ).values("parent_notification_message_id")

    for _ in range(MAX_BATCHES):
        ids = list(
            NotificationMessage.objects.filter(date_added__lt=cutoff)
            .exclude(id__in=in_retention_parent_ids)
            .values_list("id", flat=True)
            .order_by("id")[:BATCH_SIZE]
        )
        if not ids:
            break

        NotificationMessage.objects.filter(id__in=ids).delete()
