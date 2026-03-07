from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone

from sentry.models.code_review_event import CodeReviewEvent
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks

logger = logging.getLogger(__name__)

RETENTION_DAYS = 90


@instrumented_task(
    name="sentry.seer.code_review.tasks.cleanup_old_code_review_events",
    namespace=seer_code_review_tasks,
    silo_mode=SiloMode.REGION,
)
def cleanup_old_code_review_events() -> None:
    cutoff = timezone.now() - timedelta(days=RETENTION_DAYS)
    batch_size = 1000
    total_deleted = 0

    while True:
        batch_ids = list(
            CodeReviewEvent.objects.filter(date_added__lt=cutoff).values_list("id", flat=True)[
                :batch_size
            ]
        )
        if not batch_ids:
            break
        deleted_count, _ = CodeReviewEvent.objects.filter(id__in=batch_ids).delete()
        total_deleted += deleted_count

    if total_deleted:
        logger.info(
            "seer.code_review.cleanup.completed",
            extra={"deleted_count": total_deleted, "cutoff": cutoff.isoformat()},
        )
