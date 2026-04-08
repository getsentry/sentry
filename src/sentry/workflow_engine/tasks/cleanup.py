from __future__ import annotations

import logging
import time
from datetime import timedelta

from django.utils import timezone

from sentry import options
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks
from sentry.utils import metrics
from sentry.utils.query import bulk_delete_objects

logger = logging.getLogger(__name__)

OPEN_PERIOD_ACTIVITY_RETENTION_DAYS = 90


@instrumented_task(
    name="sentry.workflow_engine.tasks.cleanup.prune_old_open_period_activity",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=15,
    silo_mode=SiloMode.CELL,
)
def prune_old_open_period_activity() -> None:
    from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity

    time_limit: float = options.get(
        "workflow_engine.open_period_activity_cleanup.time_limit_seconds"
    )
    batch_size: int = options.get("workflow_engine.open_period_activity_cleanup.batch_size")

    cutoff = timezone.now() - timedelta(days=OPEN_PERIOD_ACTIVITY_RETENTION_DAYS)
    start = time.time()
    batches_deleted = 0

    while (time.time() - start) < time_limit:
        has_more = bulk_delete_objects(
            GroupOpenPeriodActivity,
            limit=batch_size,
            logger=logger,
            date_added__lte=cutoff,
        )
        if not has_more:
            break
        batches_deleted += 1

    metrics.incr(
        "workflow_engine.tasks.prune_old_open_period_activity.batches_deleted",
        amount=batches_deleted,
        sample_rate=1.0,
    )
