from __future__ import annotations

import logging
import time
from datetime import timedelta

from django.utils import timezone

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks
from sentry.utils import metrics
from sentry.utils.query import bulk_delete_objects

logger = logging.getLogger(__name__)

FIRE_HISTORY_RETENTION_DAYS = 90
FIRE_HISTORY_BATCH_SIZE = 10000
FIRE_HISTORY_TIME_LIMIT_SECONDS = 5


@instrumented_task(
    name="sentry.workflow_engine.tasks.cleanup.prune_old_fire_history",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=15,
    silo_mode=SiloMode.CELL,
)
def prune_old_fire_history() -> None:
    from sentry.workflow_engine.models import WorkflowFireHistory

    cutoff = timezone.now() - timedelta(days=FIRE_HISTORY_RETENTION_DAYS)
    start = time.time()
    batches_deleted = 0

    while (time.time() - start) < FIRE_HISTORY_TIME_LIMIT_SECONDS:
        has_more = bulk_delete_objects(
            WorkflowFireHistory,
            limit=FIRE_HISTORY_BATCH_SIZE,
            logger=logger,
            date_added__lte=cutoff,
        )
        if not has_more:
            break
        batches_deleted += 1

    metrics.incr(
        "workflow_engine.tasks.prune_old_fire_history.batches_deleted",
        amount=batches_deleted,
        sample_rate=1.0,
    )
