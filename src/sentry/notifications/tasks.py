import logging
from datetime import timedelta

from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import deletion_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

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
    total_deleted = 0

    for _ in range(MAX_BATCHES):
        ids = list(
            NotificationMessage.objects.filter(date_added__lt=cutoff)
            .values_list("id", flat=True)
            .order_by("id")[:BATCH_SIZE]
        )
        if not ids:
            break

        _, deleted_by_model = NotificationMessage.objects.filter(id__in=ids).delete()
        total_deleted += deleted_by_model.get("notifications.NotificationMessage", 0)

    metrics.incr(
        "notifications.delete_old_notification_messages.deleted",
        amount=total_deleted,
        sample_rate=1.0,
    )
    logger.info(
        "delete_old_notification_messages.completed",
        extra={"deleted": total_deleted, "cutoff": cutoff.isoformat()},
    )
