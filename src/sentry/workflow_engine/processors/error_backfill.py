"""Error detector backfill job implementation."""

import logging
from collections.abc import Iterable
from datetime import timedelta
from typing import Any

from django.db.models import Exists, OuterRef
from pydantic import BaseModel

from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import Group, GroupStatus
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper
from sentry.workflow_engine.models import Detector, DetectorGroup
from sentry.workflow_engine.processors.bulk_job import BulkJobSpec, bulk_job_registry

logger = logging.getLogger(__name__)

GROUPS_PER_BATCH = 400


class ErrorDetectorWorkChunk(BaseModel):
    """Work chunk for backfilling error detector groups."""

    detector_id: int


class ErrorBackfillJob(BulkJobSpec):
    """Bulk job specification for backfilling error detector groups."""

    job_type = "error_backfill"
    work_chunk_model = ErrorDetectorWorkChunk

    # Configuration for coordination
    max_batch_size = 100
    target_running_tasks = 50
    in_progress_timeout = timedelta(hours=1)
    completed_cleanup_age = timedelta(days=30)

    def process_work_chunk(self, work_chunk: BaseModel) -> dict[str, Any]:
        return _backfill_detector_groups(work_chunk)  # type: ignore[arg-type]

    def generate_work_chunks(self, start_from: str | None) -> Iterable[BaseModel]:
        return _generate_error_detector_work_chunks(start_from)

    def get_batch_key(self, work_chunk: BaseModel) -> str:
        return _get_error_detector_batch_key(work_chunk)  # type: ignore[arg-type]


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

    metrics.incr("error_backfill.groups_created", amount=created_count)

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


# Create singleton instance and register it
ERROR_BACKFILL_JOB = ErrorBackfillJob()
bulk_job_registry.register("error_backfill")(ERROR_BACKFILL_JOB)
