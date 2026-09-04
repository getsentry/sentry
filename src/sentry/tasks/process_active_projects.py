from __future__ import annotations

import logging

from sentry import features
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics
from sentry.utils.query import iter_id_ranges

logger = logging.getLogger(__name__)

ISSUE_ACTION_LOG_WRITE_TO_DB = "projects:issue-action-log-write-to-db"
MAX_RANGES_PER_COORDINATOR = 100
PROJECTS_PER_RANGE = 500


def _active_projects_qs():
    return Project.objects.filter(status=ObjectStatus.ACTIVE)


@instrumented_task(
    name="sentry.tasks.process_active_projects.process_active_projects",
    namespace=issues_tasks,
    processing_deadline_duration=5 * 60,
    silo_mode=SiloMode.CELL,
)
def process_active_projects(start_id: int = 0, **kwargs: object) -> None:
    """
    Walk active projects in id order, dispatching batch tasks for up to
    ``MAX_RANGES_PER_COORDINATOR`` id ranges, then reschedule with a new
    ``start_id`` until the table is exhausted.
    """
    ranges = list(
        iter_id_ranges(
            _active_projects_qs(),
            PROJECTS_PER_RANGE,
            start_after=start_id,
            max_ranges=MAX_RANGES_PER_COORDINATOR,
        )
    )

    if not ranges:
        logger.info(
            "process_active_projects.completed",
            extra={"start_id": start_id},
        )
        return

    for first_id, last_id in ranges:
        process_active_projects_batch.delay(first_id=first_id, last_id=last_id)

    last_id = ranges[-1][1]
    logger.info(
        "process_active_projects.dispatched",
        extra={
            "start_id": start_id,
            "range_count": len(ranges),
            "first_id": ranges[0][0],
            "last_id": last_id,
        },
    )

    if len(ranges) == MAX_RANGES_PER_COORDINATOR:
        process_active_projects.delay(start_id=last_id)


@instrumented_task(
    name="sentry.tasks.process_active_projects.process_active_projects_batch",
    namespace=issues_tasks,
    processing_deadline_duration=5 * 60,
    silo_mode=SiloMode.CELL,
)
def process_active_projects_batch(first_id: int, last_id: int, **kwargs: object) -> None:
    """
    Process active projects with ``first_id <= id <= last_id``.

    Counts how many have the action-log write-to-db feature enabled.
    """
    projects = _active_projects_qs().filter(id__gte=first_id, id__lte=last_id).order_by("id")

    enabled = 0
    checked = 0
    for project in projects.iterator():
        checked += 1
        if features.has(ISSUE_ACTION_LOG_WRITE_TO_DB, project):
            enabled += 1

    if enabled:
        metrics.incr(
            "process_active_projects.action_log_write_to_db_enabled",
            amount=enabled,
            sample_rate=1.0,
        )

    logger.info(
        "process_active_projects.batch_complete",
        extra={
            "first_id": first_id,
            "last_id": last_id,
            "checked": checked,
            "enabled": enabled,
        },
    )
