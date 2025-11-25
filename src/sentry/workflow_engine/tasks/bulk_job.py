"""Generic tasks for bulk job processing."""

import logging
from typing import Any

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks

logger = logging.getLogger(__name__)

# Maximum number of times populate task can reschedule itself
MAX_POPULATE_ITERATIONS = 1000


@instrumented_task(
    name="sentry.workflow_engine.tasks.bulk_job.process_bulk_job",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=300,
    silo_mode=SiloMode.REGION,
)
def process_bulk_job_task(job_status_id: int, job_type: str, **kwargs: dict[str, Any]) -> None:
    """
    Generic task to process a single BulkJobStatus record for any job type.

    This task:
    1. Marks the job status as in_progress
    2. Processes the work chunk using the job-specific processor
    3. Marks the job status as completed
    """
    from sentry.workflow_engine.processors.bulk_job import process_bulk_job

    process_bulk_job(job_status_id)


@instrumented_task(
    name="sentry.workflow_engine.tasks.bulk_job.coordinate_bulk_jobs",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=300,
    silo_mode=SiloMode.REGION,
)
def coordinate_bulk_jobs_task(job_type: str, **kwargs: dict[str, Any]) -> None:
    """
    Generic coordinator task for bulk jobs.

    This task runs periodically and:
    1. Finds pending items and schedules them for processing up to target concurrency
    2. Resets any in_progress items that have been stuck for too long
    3. Deletes completed items that are older than the cleanup age

    The configuration (target_running_tasks, timeouts, etc.) is read from the job spec.
    """
    from sentry.workflow_engine.processors.bulk_job import bulk_job_registry, coordinate_bulk_jobs

    job_spec = bulk_job_registry.get(job_type)

    def schedule_task(job_status_id: int) -> None:
        process_bulk_job_task.apply_async(
            kwargs={"job_status_id": job_status_id, "job_type": job_type},
            expires=int(job_spec.in_progress_timeout.total_seconds()),
        )

    coordinate_bulk_jobs(
        job_spec.job_type,
        max_batch_size=job_spec.max_batch_size,
        in_progress_timeout=job_spec.in_progress_timeout,
        completed_cleanup_age=job_spec.completed_cleanup_age,
        schedule_task_fn=schedule_task,
        target_running_tasks=job_spec.target_running_tasks,
    )


@instrumented_task(
    name="sentry.workflow_engine.tasks.bulk_job.populate_bulk_job_records",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=600,
    silo_mode=SiloMode.REGION,
)
def populate_bulk_job_records_task(
    job_type: str, start_from: str | None = None, iteration: int = 0, **kwargs: dict[str, Any]
) -> None:
    """
    Generic task to populate BulkJobStatus records for a job type.

    If the task hits its processing deadline, it reschedules itself to continue from
    where it left off. Includes a max iteration limit to prevent infinite loops.
    """
    from datetime import UTC, datetime, timedelta

    from sentry.workflow_engine.processors.bulk_job import create_bulk_job_records

    if iteration >= MAX_POPULATE_ITERATIONS:
        logger.error(
            "bulk_job.populate_max_iterations_reached",
            extra={
                "job_type": job_type,
                "iteration": iteration,
                "start_from": start_from,
            },
        )
        return

    deadline = datetime.now(UTC) + timedelta(seconds=540)
    resume_from = create_bulk_job_records(job_type, start_from=start_from, deadline=deadline)

    if resume_from is not None:
        populate_bulk_job_records_task.apply_async(
            kwargs={"job_type": job_type, "start_from": resume_from, "iteration": iteration + 1}
        )


# Backward compatibility aliases for error backfill
# These can be removed once all callers are updated to use the generic tasks


@instrumented_task(
    name="sentry.workflow_engine.tasks.error_backfill.process_error_backfill",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=300,
    silo_mode=SiloMode.REGION,
)
def process_error_backfill(backfill_status_id: int, **kwargs: dict[str, Any]) -> None:
    """
    Backward compatibility wrapper for process_bulk_job_task.
    Prefer using process_bulk_job_task with job_type parameter.
    """
    return process_bulk_job_task(backfill_status_id, "error_backfill", **kwargs)


@instrumented_task(
    name="sentry.workflow_engine.tasks.error_backfill.coordinate_error_backfill",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=300,
    silo_mode=SiloMode.REGION,
)
def coordinate_error_backfill(**kwargs: dict[str, Any]) -> None:
    """
    Backward compatibility wrapper for coordinate_bulk_jobs_task.
    Prefer using coordinate_bulk_jobs_task with job_type parameter.
    """
    return coordinate_bulk_jobs_task("error_backfill", **kwargs)


@instrumented_task(
    name="sentry.workflow_engine.tasks.error_backfill.populate_error_backfill_status",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=600,
    silo_mode=SiloMode.REGION,
)
def populate_error_backfill_status(
    start_from: str | None = None, iteration: int = 0, **kwargs: dict[str, Any]
) -> None:
    """
    Backward compatibility wrapper for populate_bulk_job_records_task.
    Prefer using populate_bulk_job_records_task with job_type parameter.
    """
    return populate_bulk_job_records_task(
        "error_backfill", start_from=start_from, iteration=iteration, **kwargs
    )
