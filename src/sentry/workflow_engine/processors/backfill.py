"""
Processor functions for backfilling DetectorGroup associations for error detectors.

These functions contain the actual business logic for the backfill process, separated
from the task definitions to avoid heavy import dependencies.
"""

import logging
from datetime import UTC, datetime, timedelta

from django.db.models import Exists, OuterRef

from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import Group, GroupStatus
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper
from sentry.workflow_engine.models import Detector, DetectorGroup, ErrorBackfillStatus

logger = logging.getLogger(__name__)

GROUPS_PER_BATCH = 400


def process_detector_backfill(backfill_status_id: int) -> None:
    """
    Process a single ErrorBackfillStatus record, creating DetectorGroup associations
    for all open ErrorGroupType Groups in the detector's project.
    """
    try:
        backfill_status = ErrorBackfillStatus.objects.select_for_update().get(id=backfill_status_id)
    except ErrorBackfillStatus.DoesNotExist:
        logger.warning(
            "error_detector_backfill.status_not_found",
            extra={"backfill_status_id": backfill_status_id},
        )
        return

    if backfill_status.status != "in_progress":
        backfill_status.status = "in_progress"
        backfill_status.save(update_fields=["status", "date_updated"])

    try:
        detector = Detector.objects.get(id=backfill_status.detector_id)
        project_id = detector.project_id

        all_unresolved_groups = Group.objects.filter(
            project_id=project_id,
            status=GroupStatus.UNRESOLVED,
            type=ErrorGroupType.type_id,
        )

        # Use NOT EXISTS subquery for efficiency
        existing_detector_groups_subquery = DetectorGroup.objects.filter(
            detector_id=detector.id, group_id=OuterRef("id")
        )

        groups_needing_detector_groups = all_unresolved_groups.exclude(
            Exists(existing_detector_groups_subquery)
        )

        created_count = 0

        for group in RangeQuerySetWrapper(groups_needing_detector_groups, step=GROUPS_PER_BATCH):
            detector_group, created = DetectorGroup.objects.get_or_create(
                detector_id=detector.id,
                group_id=group.id,
            )
            if created:
                detector_group.date_added = group.first_seen
                detector_group.save(update_fields=["date_added"])
                created_count += 1

        backfill_status.status = "completed"
        backfill_status.save(update_fields=["status", "date_updated"])

        metrics.incr("error_detector_backfill.process_success")
        metrics.incr("error_detector_backfill.groups_created", amount=created_count)

        logger.info(
            "error_detector_backfill.completed",
            extra={
                "backfill_status_id": backfill_status_id,
                "detector_id": detector.id,
                "project_id": project_id,
                "groups_created": created_count,
            },
        )

    except Exception as e:
        logger.exception(
            "error_detector_backfill.failed",
            extra={
                "backfill_status_id": backfill_status_id,
                "error": str(e),
            },
        )
        metrics.incr("error_detector_backfill.process_error")
        raise


def coordinate_backfills(
    max_batch_size: int,
    in_progress_timeout: timedelta,
    completed_cleanup_age: timedelta,
    schedule_task_fn,
) -> None:
    """
    Coordinate the error detector backfill process: reset stuck items, delete old completed
    items, and schedule new pending backfills.
    """
    stuck_cutoff = datetime.now(UTC) - in_progress_timeout
    stuck_count = ErrorBackfillStatus.objects.filter(
        status="in_progress",
        date_updated__lt=stuck_cutoff,
    ).update(
        status="not_started",
    )

    if stuck_count > 0:
        logger.info(
            "error_detector_backfill.reset_stuck",
            extra={"count": stuck_count},
        )
        metrics.incr("error_detector_backfill.reset_stuck", amount=stuck_count)

    completed_cutoff = datetime.now(UTC) - completed_cleanup_age
    deleted_count, _ = ErrorBackfillStatus.objects.filter(
        status="completed",
        date_updated__lt=completed_cutoff,
    ).delete()

    if deleted_count > 0:
        logger.info(
            "error_detector_backfill.cleaned_up",
            extra={"count": deleted_count},
        )
        metrics.incr("error_detector_backfill.cleaned_up", amount=deleted_count)

    pending_items = ErrorBackfillStatus.objects.filter(
        status="not_started",
    ).order_by(
        "date_added"
    )[:max_batch_size]

    scheduled_count = 0
    for item in pending_items:
        try:
            schedule_task_fn(item.id)
            scheduled_count += 1
        except Exception as e:
            logger.exception(
                "error_detector_backfill.schedule_failed",
                extra={
                    "backfill_status_id": item.id,
                    "error": str(e),
                },
            )

    if scheduled_count > 0:
        logger.info(
            "error_detector_backfill.scheduled",
            extra={"count": scheduled_count},
        )
        metrics.incr("error_detector_backfill.scheduled", amount=scheduled_count)

    total_pending = ErrorBackfillStatus.objects.filter(status="not_started").count()
    total_in_progress = ErrorBackfillStatus.objects.filter(status="in_progress").count()
    total_completed = ErrorBackfillStatus.objects.filter(status="completed").count()

    logger.info(
        "error_detector_backfill.coordinator_run",
        extra={
            "scheduled": scheduled_count,
            "stuck_reset": stuck_count,
            "cleaned_up": deleted_count,
            "total_pending": total_pending,
            "total_in_progress": total_in_progress,
            "total_completed": total_completed,
        },
    )

    metrics.gauge("error_detector_backfill.pending", total_pending)
    metrics.gauge("error_detector_backfill.in_progress", total_in_progress)
    metrics.gauge("error_detector_backfill.completed", total_completed)


def populate_backfill_status_records(
    start_from: int | None = None, deadline: datetime | None = None
) -> int | None:
    """
    Populate ErrorBackfillStatus records for all error detectors.

    Returns the detector ID to resume from if the deadline is reached, or None if complete.
    """

    def process_batch(detectors: list[Detector]) -> int:
        detector_ids = [d.id for d in detectors]

        existing_ids = set(
            ErrorBackfillStatus.objects.filter(detector_id__in=detector_ids).values_list(
                "detector_id", flat=True
            )
        )

        new_records = [
            ErrorBackfillStatus(detector_id=d.id, status="not_started")
            for d in detectors
            if d.id not in existing_ids
        ]

        if new_records:
            ErrorBackfillStatus.objects.bulk_create(new_records, ignore_conflicts=True)
            return len(new_records)
        return 0

    error_detectors = Detector.objects.filter(type=ErrorGroupType.slug)
    if start_from is not None:
        error_detectors = error_detectors.filter(id__gte=start_from)

    created_count = 0
    batch_size = 1000
    batch_detectors = []

    for detector in RangeQuerySetWrapper(error_detectors, step=batch_size):
        batch_detectors.append(detector)

        if deadline and datetime.now(UTC) >= deadline:
            logger.info(
                "error_detector_backfill.populate_deadline_reached",
                extra={
                    "created_count": created_count,
                    "resume_from": detector.id,
                },
            )
            metrics.incr("error_detector_backfill.populated", amount=created_count)
            return detector.id

        if len(batch_detectors) >= batch_size:
            created_count += process_batch(batch_detectors)
            batch_detectors = []

    if batch_detectors:
        created_count += process_batch(batch_detectors)

    logger.info(
        "error_detector_backfill.populated",
        extra={"created_count": created_count},
    )

    metrics.incr("error_detector_backfill.populated", amount=created_count)
    return None
