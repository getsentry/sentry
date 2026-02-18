from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.utils.query import bulk_delete_objects

RETENTION_DAYS = 90
BATCH_SIZE = 10_000


@instrumented_task(
    name="sentry.seer.code_review.tasks.cleanup_old_code_review_runs",
    namespace=seer_code_review_tasks,
    silo_mode=SiloMode.REGION,
)
def cleanup_old_code_review_runs() -> None:
    """Delete CodeReviewRun rows older than RETENTION_DAYS in batches."""
    from sentry.models.codereviewrun import CodeReviewRun

    cutoff = timezone.now() - timedelta(days=RETENTION_DAYS)
    while bulk_delete_objects(model=CodeReviewRun, limit=BATCH_SIZE, date_added__lt=cutoff):
        pass
