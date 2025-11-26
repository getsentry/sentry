import logging
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone

from sentry import audit_log
from sentry.api.helpers.group_index.delete import schedule_group_deletion_tasks
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.group import Group, GroupStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import deletion_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics

logger = logging.getLogger(__name__)

BATCH_LIMIT = 1000
PENDING_DELETION_HOURS = 24


@instrumented_task(
    name="sentry.tasks.delete_pending_groups",
    namespace=deletion_tasks,
    processing_deadline_duration=10 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.MONOLITH,
)
def delete_pending_groups() -> None:
    """
    Scheduled task that runs daily to clean up groups in pending deletion states.

    This task queries groups with status PENDING_DELETION or DELETION_IN_PROGRESS
    and schedules deletion tasks for them. Groups are batched by project to ensure
    efficient deletion processing.

    Only processes groups where the most recent ISSUE_DELETE audit log entry
    is older than PENDING_DELETION_HOURS hours (currently 24 hours).
    """
    statuses_to_delete = [GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]
    issue_delete_event_id = audit_log.get_event_id("ISSUE_DELETE")
    cutoff_time = timezone.now() - timedelta(hours=PENDING_DELETION_HOURS)

    # First, get all group IDs from audit logs where the deletion was marked more than
    # PENDING_DELETION_HOURS ago. We use a separate query because AuditLogEntry is in
    # the control silo and Group is in the region silo.
    old_deletion_group_ids = set(
        AuditLogEntry.objects.filter(
            event=issue_delete_event_id,
            datetime__lt=cutoff_time,
        )
        .values_list("target_object", flat=True)
        .distinct()[:BATCH_LIMIT]
    )

    if not old_deletion_group_ids:
        logger.info("delete_pending_groups.no_old_audit_logs_found")
        return

    # Now query groups that have deletion status AND have old audit log entries
    groups = Group.objects.filter(
        status__in=statuses_to_delete,
        id__in=old_deletion_group_ids,
    ).values_list("id", "project_id")[:BATCH_LIMIT]

    if not groups:
        logger.info("delete_pending_groups.no_groups_found")
        return

    # Group by project_id to ensure all groups in a batch belong to the same project
    groups_by_project: dict[int, list[int]] = defaultdict(list)
    for group_id, project_id in groups:
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
