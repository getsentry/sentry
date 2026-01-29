"""Backfill DetectorGroup associations for error detectors."""

import logging

from django.db.models import Exists, OuterRef

from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper
from sentry.workflow_engine.models import Detector, DetectorGroup

logger = logging.getLogger(__name__)


@metrics.timer("workflow_engine.error_backfill.duration")
def backfill_detector_groups(detector_id: int) -> None:
    """Create DetectorGroup associations for unresolved error groups in a detector's project."""
    try:
        detector = Detector.objects.get(id=detector_id)
    except Detector.DoesNotExist:
        logger.info(
            "error_backfill.detector_not_found",
            extra={"detector_id": detector_id},
        )
        return

    project_id = detector.project_id

    all_unresolved_groups = Group.objects.filter(
        project_id=project_id,
        status=GroupStatus.UNRESOLVED,
        type=ErrorGroupType.type_id,
    )

    existing_detector_groups_subquery = DetectorGroup.objects.filter(
        detector_id=detector_id, group_id=OuterRef("id")
    )

    groups_needing_detector_groups = all_unresolved_groups.exclude(
        Exists(existing_detector_groups_subquery)
    )

    created_count = 0

    for group in RangeQuerySetWrapper(groups_needing_detector_groups):
        detector_group, created = DetectorGroup.objects.get_or_create(
            detector_id=detector_id,
            group_id=group.id,
        )
        if created:
            detector_group.date_added = group.first_seen
            detector_group.save(update_fields=["date_added"])
            created_count += 1

    metrics.incr("workflow_engine.error_backfill.groups_created", amount=created_count)

    logger.info(
        "error_backfill.completed",
        extra={
            "detector_id": detector_id,
            "project_id": project_id,
            "groups_created": created_count,
        },
    )


def backfill_project_range(min_project_id: int, max_project_id: int) -> None:
    """Backfill DetectorGroups for all active projects in the given ID range."""
    projects = Project.objects.filter(
        id__gte=min_project_id, id__lte=max_project_id, status=ObjectStatus.ACTIVE
    )

    for project in projects:
        try:
            detector = Detector.get_error_detector_for_project(project.id)
        except Detector.DoesNotExist:
            logger.warning(
                "error_backfill.detector_not_found",
                extra={"project_id": project.id},
            )
            metrics.incr("workflow_engine.error_backfill.detector_not_found")
            continue

        backfill_detector_groups(detector.id)
        metrics.incr("workflow_engine.error_backfill.projects_processed", sample_rate=1.0)

    logger.info(
        "error_backfill.chunk_completed",
        extra={
            "min_project_id": min_project_id,
            "max_project_id": max_project_id,
        },
    )
