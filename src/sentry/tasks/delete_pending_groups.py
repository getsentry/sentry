import logging
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone

from sentry.api.helpers.group_index.delete import schedule_group_deletion_tasks
from sentry.audit_log.services.log.service import log_rpc_service
from sentry.models.group import Group, GroupStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import deletion_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics

logger = logging.getLogger(__name__)

BATCH_LIMIT = 1000
MAX_LAST_SEEN_DAYS = 90
MIN_LAST_SEEN_HOURS = 6


@instrumented_task(
    name="sentry.tasks.delete_pending_groups",
    namespace=deletion_tasks,
    processing_deadline_duration=10 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.REGION,
)
def delete_pending_groups() -> None:
    """
    Scheduled task that runs daily to clean up groups in pending deletion states.

    This task queries groups with status PENDING_DELETION or DELETION_IN_PROGRESS
    and schedules deletion tasks for them. Groups are batched by project to ensure
    efficient deletion processing.

    Only processes groups where deletion was requested between 6 hours and 90 days ago
    (via audit logs) to avoid processing very recent groups (safety window) or groups
    past retention period.
    """
    statuses_to_delete = [GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]

    # Just using status to take advantage of the status DB index
    groups = list(
        Group.objects.filter(status__in=statuses_to_delete).values_list(
            "id", "project_id", "last_seen"
        )
    )

    now = timezone.now()
    min_last_seen = now - timedelta(days=MAX_LAST_SEEN_DAYS)
    cutoff_time = now - timedelta(hours=MIN_LAST_SEEN_HOURS)

    # Query audit logs to find groups where deletion was requested in the time range
    # (between 90 days ago and 6 hours ago)
    non_recent_deletion_group_ids = set(
        log_rpc_service.find_issue_deletions_before(
            cutoff_datetime=cutoff_time,
            min_datetime=min_last_seen,
            limit=BATCH_LIMIT,
        )
    )

    # Group by project_id to ensure all groups in a batch belong to the same project
    groups_by_project: dict[int, list[int]] = defaultdict(list)
    for group_id, project_id, last_seen in groups:
        if last_seen >= min_last_seen and group_id in non_recent_deletion_group_ids:
            groups_by_project[project_id].append(group_id)

    if not groups_by_project:
        logger.info("delete_pending_groups.no_groups_in_limbo_found")
        return

    total_groups = sum(len(group_ids) for group_ids in groups_by_project.values())
    total_tasks = 0

    logger.info(
        "delete_pending_groups.started",
        extra={"total_groups": total_groups, "projects_count": len(groups_by_project)},
    )

    for project_id, group_ids in groups_by_project.items():
        total_tasks += schedule_group_deletion_tasks(project_id, group_ids)

    metrics.incr("delete_pending_groups.groups_scheduled", amount=total_groups, sample_rate=1.0)
    metrics.incr("delete_pending_groups.tasks_scheduled", amount=total_tasks, sample_rate=1.0)

    logger.info("delete_pending_groups.completed")
