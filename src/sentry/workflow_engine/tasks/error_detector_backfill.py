"""Tasks for backfilling DetectorGroup associations for error detectors."""

from datetime import timedelta
from typing import Any

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks

MAX_BACKFILL_BATCH_SIZE = 100
IN_PROGRESS_TIMEOUT = timedelta(hours=1)
COMPLETED_CLEANUP_AGE = timedelta(days=30)


@instrumented_task(
    name="sentry.workflow_engine.tasks.error_detector_backfill.process_error_backfill",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=300,
    silo_mode=SiloMode.REGION,
)
def process_error_backfill(backfill_status_id: int, **kwargs: dict[str, Any]) -> None:
    """
    Process a single ErrorBackfillStatus record, creating DetectorGroup associations
    for all open ErrorGroupType Groups in the detector's project.

    This task:
    1. Marks the backfill status as in_progress
    2. Finds all unresolved error Groups without DetectorGroups in the project
    3. Creates DetectorGroup records for them in batches
    4. Marks the backfill status as completed
    """
    from sentry.workflow_engine.processors.backfill import process_detector_backfill

    process_detector_backfill(backfill_status_id)


@instrumented_task(
    name="sentry.workflow_engine.tasks.error_detector_backfill.coordinate_error_backfill",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=300,
    silo_mode=SiloMode.REGION,
)
def coordinate_error_backfill(**kwargs: dict[str, Any]) -> None:
    """
    Coordinate the error detector backfill process.

    This task runs periodically and:
    1. Finds up to N pending backfill items and schedules them for processing
    2. Resets any in_progress items that have been stuck for more than 1 hour
    3. Deletes completed items that are older than 30 days
    """
    from sentry.workflow_engine.processors.backfill import coordinate_backfills

    def schedule_task(backfill_status_id: int) -> None:
        process_error_backfill.apply_async(
            kwargs={"backfill_status_id": backfill_status_id},
            expires=int(IN_PROGRESS_TIMEOUT.total_seconds()),
        )

    coordinate_backfills(
        max_batch_size=MAX_BACKFILL_BATCH_SIZE,
        in_progress_timeout=IN_PROGRESS_TIMEOUT,
        completed_cleanup_age=COMPLETED_CLEANUP_AGE,
        schedule_task_fn=schedule_task,
    )


@instrumented_task(
    name="sentry.workflow_engine.tasks.error_detector_backfill.populate_error_backfill_status",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=600,
    silo_mode=SiloMode.REGION,
)
def populate_error_backfill_status(start_from: int | None = None, **kwargs: dict[str, Any]) -> None:
    """
    Populate ErrorBackfillStatus records for all error detectors.

    If the task hits its processing deadline, it reschedules itself to continue from
    where it left off.
    """
    from datetime import UTC, datetime, timedelta

    from sentry.workflow_engine.processors.backfill import populate_backfill_status_records

    deadline = datetime.now(UTC) + timedelta(seconds=540)
    resume_from = populate_backfill_status_records(start_from=start_from, deadline=deadline)

    if resume_from is not None:
        populate_error_backfill_status.apply_async(kwargs={"start_from": resume_from})
