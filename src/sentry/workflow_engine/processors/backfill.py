"""
Processor functions for bulk job execution.

Defines the BulkJobSpec infrastructure for generic bulk job processing, along with
specific job implementations like error detector backfilling.
"""

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from django.db.models import Exists, OuterRef
from pydantic import BaseModel

from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import Group, GroupStatus
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper
from sentry.workflow_engine.models import BulkJobState, BulkJobStatus, Detector, DetectorGroup

logger = logging.getLogger(__name__)

GROUPS_PER_BATCH = 400


@dataclass
class BulkJobSpec:
    """
    Specification for a bulk job type.

    This dataclass captures all job-specific behavior, allowing new bulk jobs
    to be defined without modifying the generic execution infrastructure.
    """

    job_type: str
    work_chunk_model: type[BaseModel]
    process_work_chunk: Callable[[BaseModel], dict[str, Any]]
    generate_work_chunks: Callable[[str | None], Iterable[BaseModel]]
    get_batch_key: Callable[[BaseModel], str]


# ============================================================================
# Error Detector Backfill Job Implementation
# ============================================================================


class ErrorDetectorWorkChunk(BaseModel):
    """Work chunk for backfilling error detector groups."""

    detector_id: int


def _backfill_detector_groups(work_chunk: ErrorDetectorWorkChunk) -> dict[str, Any]:
    """
    Create DetectorGroup associations for all unresolved ErrorGroupType Groups
    in the detector's project that don't already have a DetectorGroup.

    Returns a dict with backfill results to be included in logging extra data.
    """
    detector_id = work_chunk.detector_id
    detector = Detector.objects.get(id=detector_id)
    project_id = detector.project_id

    all_unresolved_groups = Group.objects.filter(
        project_id=project_id,
        status=GroupStatus.UNRESOLVED,
        type=ErrorGroupType.type_id,
    )

    # Use NOT EXISTS subquery for efficiency
    existing_detector_groups_subquery = DetectorGroup.objects.filter(
        detector_id=detector_id, group_id=OuterRef("id")
    )

    groups_needing_detector_groups = all_unresolved_groups.exclude(
        Exists(existing_detector_groups_subquery)
    )

    created_count = 0

    for group in RangeQuerySetWrapper(groups_needing_detector_groups, step=GROUPS_PER_BATCH):
        detector_group, created = DetectorGroup.objects.get_or_create(
            detector_id=detector_id,
            group_id=group.id,
        )
        if created:
            detector_group.date_added = group.first_seen
            detector_group.save(update_fields=["date_added"])
            created_count += 1

    metrics.incr("error_detector_backfill.groups_created", amount=created_count)

    return {
        "detector_id": detector_id,
        "project_id": project_id,
        "groups_created": created_count,
    }


def _generate_error_detector_work_chunks(
    start_from: str | None,
) -> Iterable[ErrorDetectorWorkChunk]:
    """Generate work chunks for all error detectors."""
    error_detectors = Detector.objects.filter(type=ErrorGroupType.slug)
    if start_from is not None:
        # Extract detector_id from batch_key format "error_detector:{id}"
        detector_id = int(start_from.split(":")[-1])
        error_detectors = error_detectors.filter(id__gte=detector_id)

    for detector in error_detectors.iterator():
        yield ErrorDetectorWorkChunk(detector_id=detector.id)


def _get_error_detector_batch_key(work_chunk: ErrorDetectorWorkChunk) -> str:
    """Get the batch key for an error detector work chunk."""
    return f"error_detector:{work_chunk.detector_id}"


# Error detector backfill job specification
ERROR_DETECTOR_BACKFILL_JOB = BulkJobSpec(
    job_type="error_detector_backfill",
    work_chunk_model=ErrorDetectorWorkChunk,
    process_work_chunk=_backfill_detector_groups,
    generate_work_chunks=_generate_error_detector_work_chunks,
    get_batch_key=_get_error_detector_batch_key,
)


# ============================================================================
# Generic Bulk Job Processing Infrastructure
# ============================================================================

# Registry of all bulk job specs
BULK_JOB_REGISTRY: dict[str, BulkJobSpec] = {
    ERROR_DETECTOR_BACKFILL_JOB.job_type: ERROR_DETECTOR_BACKFILL_JOB,
}


def process_bulk_job(job_status_id: int) -> None:
    """
    Generic processor for any bulk job type.

    Looks up the job spec from the registry and executes the job-specific processing logic.
    """
    try:
        job_status = BulkJobStatus.objects.select_for_update().get(id=job_status_id)
    except BulkJobStatus.DoesNotExist:
        logger.warning(
            "bulk_job.status_not_found",
            extra={"job_status_id": job_status_id},
        )
        return

    job_spec = BULK_JOB_REGISTRY.get(job_status.job_type)
    if not job_spec:
        logger.error(
            "bulk_job.unknown_job_type",
            extra={"job_status_id": job_status_id, "job_type": job_status.job_type},
        )
        return

    if job_status.status != BulkJobState.IN_PROGRESS:
        job_status.status = BulkJobState.IN_PROGRESS
        job_status.save(update_fields=["status", "date_updated"])

    try:
        # Deserialize work chunk using job-specific model
        work_chunk = job_spec.work_chunk_model(**job_status.work_chunk_info)

        # Execute job-specific processing
        result = job_spec.process_work_chunk(work_chunk)

        job_status.status = BulkJobState.COMPLETED
        job_status.save(update_fields=["status", "date_updated"])

        metrics.incr(f"{job_status.job_type}.process_success")

        logger.info(
            "bulk_job.completed",
            extra={
                "job_status_id": job_status_id,
                "job_type": job_status.job_type,
                **result,
            },
        )

    except Exception as e:
        logger.exception(
            "bulk_job.failed",
            extra={
                "job_status_id": job_status_id,
                "job_type": job_status.job_type,
                "error": str(e),
            },
        )
        metrics.incr(f"{job_status.job_type}.process_error")
        raise


def coordinate_bulk_jobs(
    job_type: str,
    max_batch_size: int,
    in_progress_timeout: timedelta,
    completed_cleanup_age: timedelta,
    schedule_task_fn: Callable[[int], None],
) -> None:
    """
    Generic coordinator for bulk jobs: reset stuck items, delete old completed items,
    and schedule new pending jobs.
    """
    stuck_cutoff = datetime.now(UTC) - in_progress_timeout
    stuck_count = BulkJobStatus.objects.filter(
        job_type=job_type,
        status=BulkJobState.IN_PROGRESS,
        date_updated__lt=stuck_cutoff,
    ).update(
        status=BulkJobState.NOT_STARTED,
    )

    if stuck_count > 0:
        logger.info(
            "bulk_job.reset_stuck",
            extra={"count": stuck_count, "job_type": job_type},
        )
        metrics.incr(f"{job_type}.reset_stuck", amount=stuck_count)

    completed_cutoff = datetime.now(UTC) - completed_cleanup_age
    deleted_count, _ = BulkJobStatus.objects.filter(
        job_type=job_type,
        status=BulkJobState.COMPLETED,
        date_updated__lt=completed_cutoff,
    ).delete()

    if deleted_count > 0:
        logger.info(
            "bulk_job.cleaned_up",
            extra={"count": deleted_count, "job_type": job_type},
        )
        metrics.incr(f"{job_type}.cleaned_up", amount=deleted_count)

    pending_items = BulkJobStatus.objects.filter(
        job_type=job_type,
        status=BulkJobState.NOT_STARTED,
    ).order_by("date_added")[:max_batch_size]

    scheduled_count = 0
    for item in pending_items:
        try:
            schedule_task_fn(item.id)
            scheduled_count += 1
        except Exception as e:
            logger.exception(
                "bulk_job.schedule_failed",
                extra={
                    "job_status_id": item.id,
                    "job_type": job_type,
                    "error": str(e),
                },
            )

    if scheduled_count > 0:
        logger.info(
            "bulk_job.scheduled",
            extra={"count": scheduled_count, "job_type": job_type},
        )
        metrics.incr(f"{job_type}.scheduled", amount=scheduled_count)

    total_pending = BulkJobStatus.objects.filter(
        job_type=job_type, status=BulkJobState.NOT_STARTED
    ).count()
    total_in_progress = BulkJobStatus.objects.filter(
        job_type=job_type, status=BulkJobState.IN_PROGRESS
    ).count()
    total_completed = BulkJobStatus.objects.filter(
        job_type=job_type, status=BulkJobState.COMPLETED
    ).count()

    logger.info(
        "bulk_job.coordinator_run",
        extra={
            "job_type": job_type,
            "scheduled": scheduled_count,
            "stuck_reset": stuck_count,
            "cleaned_up": deleted_count,
            "total_pending": total_pending,
            "total_in_progress": total_in_progress,
            "total_completed": total_completed,
        },
    )

    metrics.gauge(f"{job_type}.pending", total_pending)
    metrics.gauge(f"{job_type}.in_progress", total_in_progress)
    metrics.gauge(f"{job_type}.completed", total_completed)


def create_bulk_job_records(
    job_type: str,
    start_from: str | None = None,
    deadline: datetime | None = None,
    batch_size: int = 1000,
) -> str | None:
    """
    Create BulkJobStatus records for a bulk job type.

    Returns a resume key if the deadline is reached, or None if complete.
    """
    job_spec = BULK_JOB_REGISTRY.get(job_type)
    if not job_spec:
        logger.error(
            "bulk_job.unknown_job_type",
            extra={"job_type": job_type},
        )
        return None

    created_count = 0
    work_chunk_batch: list[BaseModel] = []

    for work_chunk in job_spec.generate_work_chunks(start_from):
        work_chunk_batch.append(work_chunk)

        if deadline and datetime.now(UTC) >= deadline:
            resume_key = job_spec.get_batch_key(work_chunk)
            logger.info(
                "bulk_job.populate_deadline_reached",
                extra={
                    "job_type": job_type,
                    "created_count": created_count,
                    "resume_from": resume_key,
                },
            )
            metrics.incr(f"{job_type}.populated", amount=created_count)
            return resume_key

        if len(work_chunk_batch) >= batch_size:
            created_count += _create_job_records_batch(job_type, job_spec, work_chunk_batch)
            work_chunk_batch = []

    if work_chunk_batch:
        created_count += _create_job_records_batch(job_type, job_spec, work_chunk_batch)

    logger.info(
        "bulk_job.populated",
        extra={"job_type": job_type, "created_count": created_count},
    )

    metrics.incr(f"{job_type}.populated", amount=created_count)
    return None


def _create_job_records_batch(
    job_type: str, job_spec: BulkJobSpec, work_chunks: list[BaseModel]
) -> int:
    """
    Create BulkJobStatus records for a batch of work chunks.

    Returns the number of new records created.
    """
    batch_keys = {job_spec.get_batch_key(chunk) for chunk in work_chunks}

    existing_keys = set(
        BulkJobStatus.objects.filter(job_type=job_type, batch_key__in=batch_keys).values_list(
            "batch_key", flat=True
        )
    )

    new_records = []
    for chunk in work_chunks:
        batch_key = job_spec.get_batch_key(chunk)
        if batch_key not in existing_keys:
            record = BulkJobStatus(
                job_type=job_type,
                batch_key=batch_key,
                work_chunk_info=chunk.dict(),
                status=BulkJobState.NOT_STARTED,
            )
            new_records.append(record)

    if new_records:
        BulkJobStatus.objects.bulk_create(new_records, ignore_conflicts=True)
        return len(new_records)
    return 0
