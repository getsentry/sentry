import logging
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone

from sentry.api.helpers.group_index.delete import schedule_group_deletion_tasks
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

    Only processes groups with last_seen between 6 hours and 90 days ago to avoid
    processing very recent groups (safety window) or groups past retention period.
    """
    statuses_to_delete = [GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]

    # Just using status to take advantage of the status DB index
    groups = Group.objects.filter(status__in=statuses_to_delete).values_list(
        "id", "project_id", "last_seen"
    )[:BATCH_LIMIT]

    if not groups:
        logger.info("delete_pending_groups.no_groups_found")
        return

    # Process groups between 6 hours and 90 days old
    now = timezone.now()
    min_last_seen = now - timedelta(days=MAX_LAST_SEEN_DAYS)
    max_last_seen = now - timedelta(hours=MIN_LAST_SEEN_HOURS)
    # Group by project_id to ensure all groups in a batch belong to the same project
    groups_by_project: dict[int, list[int]] = defaultdict(list)
    for group_id, project_id, last_seen in groups:
        if last_seen >= min_last_seen and last_seen <= max_last_seen:
            groups_by_project[project_id].append(group_id)

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
