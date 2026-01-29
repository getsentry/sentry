"""Tasks for backfilling DetectorGroup associations for error detectors."""

from typing import Any

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import bulk_backfill_tasks
from sentry.taskworker.retry import Retry


@instrumented_task(
    name="sentry.workflow_engine.tasks.backfill_error_detector_groups",
    namespace=bulk_backfill_tasks,
    processing_deadline_duration=300,
    silo_mode=SiloMode.REGION,
    retry=Retry(times=3, delay=6),
)
@retry(timeouts=True)
def backfill_error_detector_groups(min_project_id: int, max_project_id: int, **kwargs: Any) -> None:
    """Backfill DetectorGroups for all active projects in the given ID range."""
    from sentry.workflow_engine.processors.backfill import backfill_project_range

    backfill_project_range(min_project_id, max_project_id)
