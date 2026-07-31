import logging

from taskbroker_client.state import current_task

from sentry import options
from sentry.issues.action_log.backfill import BACKFILL_PR_LIFECYCLE_SOURCE
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.utils import metrics

logger = logging.getLogger(__name__)

_TASK_KEY = "backfill_pr_lifecycle_action_log_for_project"


@instrumented_task(
    name=(
        "sentry.tasks.backfill_pr_lifecycle_action_log.backfill_pr_lifecycle_action_log_for_group"
    ),
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def backfill_pr_lifecycle_action_log_for_group(
    group_id: int,
    **kwargs: object,
) -> None:
    from sentry.issues.action_log.backfill import backfill_group_pr_lifecycle

    try:
        group = Group.objects.get(id=group_id)
    except Group.DoesNotExist:
        logger.warning(
            "backfill_pr_lifecycle_action_log.group_not_found",
            extra={"group_id": group_id},
        )
        return

    try:
        total = backfill_group_pr_lifecycle(
            group_id=group.id,
            project_id=group.project_id,
        )
    except Exception:
        logger.exception(
            "backfill_pr_lifecycle_action_log.group_failed",
            extra={"group_id": group.id, "project_id": group.project_id},
        )
        raise

    logger.info(
        "backfill_pr_lifecycle_action_log.group_completed",
        extra={
            "group_id": group.id,
            "project_id": group.project_id,
            "total_created": total,
        },
    )


@instrumented_task(
    name=(
        "sentry.tasks.backfill_pr_lifecycle_action_log.backfill_pr_lifecycle_action_log_for_project"
    ),
    namespace=issues_tasks,
    processing_deadline_duration=15 * 60,
    silo_mode=SiloMode.CELL,
)
def backfill_pr_lifecycle_action_log_for_project(
    project_id: int,
    cursor_group_id: int = 0,
    reset: bool = False,
    **kwargs: object,
) -> None:
    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_TASK_KEY, activation_id):
        logger.info(
            "backfill_pr_lifecycle_action_log.duplicate_redelivery.skipped",
            extra={"project_id": project_id, "activation_id": activation_id},
        )
        metrics.incr("taskworker.selfchain.duplicate_skipped", tags={"task": _TASK_KEY})
        return

    if options.get("issues.backfill_pr_lifecycle_action_log.killswitch"):
        logger.info("backfill_pr_lifecycle_action_log.killswitch_enabled")
        return

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return

    if reset and cursor_group_id == 0:
        _reset_project(project)

    try:
        _backfill_project(project, cursor_group_id, activation_id)
    except Exception:
        logger.exception(
            "backfill_pr_lifecycle_action_log.task_failed",
            extra={"project_id": project.id, "cursor_group_id": cursor_group_id},
        )
        raise


def _reset_project(project: Project) -> None:
    from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
    from sentry.issues.models.groupderiveddata import GroupDerivedData

    deleted_derived, _ = GroupDerivedData.objects.filter(group__project_id=project.id).delete()
    deleted_entries, _ = GroupActionLogEntry.objects.filter(
        project_id=project.id,
        source=BACKFILL_PR_LIFECYCLE_SOURCE,
    ).delete()

    logger.info(
        "backfill_pr_lifecycle_action_log.project_reset_completed",
        extra={
            "project_id": project.id,
            "deleted_entries": deleted_entries,
            "deleted_derived": deleted_derived,
        },
    )


def _backfill_project(
    project: Project,
    cursor_group_id: int,
    activation_id: str | None = None,
) -> None:
    from sentry.issues.action_log.backfill import backfill_group_pr_lifecycle
    from sentry.issues.derived.tasks import process_project_derived_data

    batch_size: int = options.get("issues.backfill_pr_lifecycle_action_log.batch_size")
    inter_batch_delay_s: int = options.get(
        "issues.backfill_pr_lifecycle_action_log.inter_batch_delay_s"
    )

    if batch_size <= 0:
        logger.error(
            "backfill_pr_lifecycle_action_log.invalid_batch_size",
            extra={"project_id": project.id, "batch_size": batch_size},
        )
        return

    group_ids = list(
        GroupLink.objects.filter(
            project_id=project.id,
            group_id__gt=cursor_group_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
        )
        .order_by("group_id")
        .values_list("group_id", flat=True)
        .distinct()[:batch_size]
    )

    if not group_ids:
        logger.info(
            "backfill_pr_lifecycle_action_log.project_completed",
            extra={"project_id": project.id},
        )
        process_project_derived_data.delay(project_id=project.id)
        return

    total_created = 0
    for group_id in group_ids:
        total_created += backfill_group_pr_lifecycle(
            group_id=group_id,
            project_id=project.id,
        )

    next_cursor_group_id = group_ids[-1]
    logger.info(
        "backfill_pr_lifecycle_action_log.batch_complete",
        extra={
            "project_id": project.id,
            "group_count": len(group_ids),
            "total_created": total_created,
            "next_cursor_group_id": next_cursor_group_id,
        },
    )

    if len(group_ids) == batch_size:
        backfill_pr_lifecycle_action_log_for_project.apply_async(
            kwargs={
                "project_id": project.id,
                "cursor_group_id": next_cursor_group_id,
            },
            countdown=inter_batch_delay_s,
            headers={"sentry-propagate-traces": False},
        )
        if activation_id:
            mark_spawned(_TASK_KEY, activation_id)
    else:
        logger.info(
            "backfill_pr_lifecycle_action_log.project_completed",
            extra={"project_id": project.id},
        )
        process_project_derived_data.delay(project_id=project.id)
