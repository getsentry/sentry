import logging
import time
from datetime import datetime

from django.utils import timezone
from taskbroker_client.state import current_task

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.issues.action_log.backfill import (
    BACKFILL_ACTIVITY_SOURCE,
    bulk_insert_action_log_entries,
)
from sentry.issues.action_log.types import SYSTEM_ACTOR, GroupActionActor
from sentry.issues.derived.gate import GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_long_tasks, issues_tasks
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.utils import json, metrics
from sentry.utils.action_log.activity_translator import (
    activity_action_idempotency_key,
    activity_to_action,
)

logger = logging.getLogger(__name__)

_TASK_KEY = "backfill_group_action_log_for_project"
_COORDINATOR_TASK_KEY = "backfill_group_action_log_coordinator"
_ENROLLMENT_TASK_KEY = "enroll_projects_for_group_action_log_backfill"
_ORGANIZATION_ENROLLMENT_TASK_KEY = "enroll_organization_projects_for_group_action_log_backfill"
_GROUP_ACTION_LOG_WRITE_FEATURE = "projects:issue-action-log-write-to-db"


@instrumented_task(
    name="sentry.tasks.backfill_group_action_log.backfill_group_action_log_for_group",
    namespace=issues_long_tasks,
    alias_namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def backfill_group_action_log_for_group(
    group_id: int,
    **kwargs: object,
) -> None:
    from sentry.issues.action_log.backfill import backfill_group_activities

    try:
        group = Group.objects.get(id=group_id)
    except Group.DoesNotExist:
        logger.warning(
            "backfill_group_action_log.group_not_found",
            extra={"group_id": group_id},
        )
        return

    try:
        total = backfill_group_activities(
            group_id=group_id,
            project_id=group.project_id,
        )
    except Exception:
        logger.exception(
            "backfill_group_action_log.group_failed",
            extra={"group_id": group_id, "project_id": group.project_id},
        )
        raise

    logger.info(
        "backfill_group_action_log.group_completed",
        extra={
            "group_id": group_id,
            "project_id": group.project_id,
            "total_created": total,
        },
    )


@instrumented_task(
    name="sentry.tasks.backfill_group_action_log.reset_and_backfill_group_action_log",
    namespace=issues_long_tasks,
    alias_namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def reset_and_backfill_group_action_log(
    group_id: int,
    **kwargs: object,
) -> None:
    from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
    from sentry.issues.models.groupderiveddata import GroupDerivedData

    try:
        group = Group.objects.get(id=group_id)
    except Group.DoesNotExist:
        logger.warning(
            "backfill_group_action_log.group_not_found",
            extra={"group_id": group_id},
        )
        return

    GroupDerivedData.objects.filter(group_id=group_id).delete()

    deleted_count, _ = GroupActionLogEntry.objects.filter(
        group_id=group_id,
        source="backfill:activity",
    ).delete()

    logger.info(
        "backfill_group_action_log.reset_completed",
        extra={
            "group_id": group_id,
            "project_id": group.project_id,
            "deleted_count": deleted_count,
        },
    )

    backfill_group_action_log_for_group.delay(group_id=group_id)


@instrumented_task(
    name="sentry.tasks.backfill_group_action_log.backfill_group_action_log_for_project",
    namespace=issues_long_tasks,
    alias_namespace=issues_tasks,
    processing_deadline_duration=15 * 60,
    silo_mode=SiloMode.CELL,
)
def backfill_group_action_log_for_project(
    project_id: int,
    last_activity_id: int = 0,
    reset: bool = False,
    cursor_datetime: str | None = None,
    cursor_id: int = 0,
    chain_pr_lifecycle: bool = False,
    **kwargs: object,
) -> None:
    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_TASK_KEY, activation_id):
        logger.info(
            "backfill_group_action_log.duplicate_redelivery.skipped",
            extra={"project_id": project_id, "activation_id": activation_id},
        )
        metrics.incr("taskworker.selfchain.duplicate_skipped", tags={"task": _TASK_KEY})
        return

    if options.get("issues.backfill_group_action_log.killswitch"):
        logger.info("backfill_group_action_log.killswitch_enabled")
        return

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return

    if reset and cursor_datetime is None:
        _reset_project(project)

    parsed_cursor = datetime.fromisoformat(cursor_datetime) if cursor_datetime else None

    try:
        _backfill_project(
            project,
            parsed_cursor,
            cursor_id,
            activation_id,
            chain_pr_lifecycle,
        )
    except Exception:
        logger.exception(
            "backfill_group_action_log.task_failed",
            extra={
                "project_id": project_id,
                "cursor_datetime": cursor_datetime,
                "cursor_id": cursor_id,
            },
        )
        raise


def _reset_project(project: Project) -> None:
    from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
    from sentry.issues.models.groupderiveddata import GroupDerivedData

    deleted_derived, _ = GroupDerivedData.objects.filter(
        group__project_id=project.id,
    ).delete()

    deleted_entries, _ = GroupActionLogEntry.objects.filter(
        project_id=project.id,
        source=BACKFILL_ACTIVITY_SOURCE,
    ).delete()

    project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, False)

    logger.info(
        "backfill_group_action_log.project_reset_completed",
        extra={
            "project_id": project.id,
            "deleted_entries": deleted_entries,
            "deleted_derived": deleted_derived,
        },
    )


def _backfill_project(
    project: Project,
    cursor_dt: datetime | None,
    cursor_id: int = 0,
    activation_id: str | None = None,
    chain_pr_lifecycle: bool = False,
) -> None:
    batch_size: int = options.get("issues.backfill_group_action_log.batch_size")
    inter_batch_delay_s: int = options.get("issues.backfill_group_action_log.inter_batch_delay_s")

    if batch_size <= 0:
        logger.error(
            "backfill_group_action_log.invalid_batch_size",
            extra={"project_id": project.id, "batch_size": batch_size},
        )
        return

    qs = Activity.objects.filter(
        project_id=project.id,
        group_id__isnull=False,
    )
    if cursor_dt is not None:
        qs = qs.extra(  # type: ignore[assignment]
            where=['ROW("datetime", "id") > ROW(%s, %s)'],
            params=[cursor_dt, cursor_id],
        )
    activities = list(qs.order_by("datetime", "id")[:batch_size])

    if not activities:
        logger.info(
            "backfill_group_action_log.project_completed",
            extra={"project_id": project.id},
        )
        _complete_project_backfill(project, chain_pr_lifecycle)
        return

    logger.info(
        "backfill_group_action_log.batch_starting",
        extra={
            "project_id": project.id,
            "cursor_datetime": cursor_dt.isoformat() if cursor_dt else None,
            "batch_size": len(activities),
            "first_activity_id": activities[0].id,
            "last_activity_id_in_batch": activities[-1].id,
        },
    )

    params: list[int | str | datetime] = []
    skipped_count = 0
    error_count = 0
    num_entries = 0

    for activity in activities:
        try:
            action = activity_to_action(activity)
        except Exception:
            logger.exception(
                "backfill_group_action_log.translation_error",
                extra={"activity_id": activity.id, "activity_type": activity.type},
            )
            error_count += 1
            continue
        if action is None:
            skipped_count += 1
            continue

        if activity.user_id is not None:
            actor = GroupActionActor.user(activity.user_id)
        else:
            actor = SYSTEM_ACTOR

        params.extend(
            [
                activity.group_id,
                activity.project_id,
                action.get_type().value,
                actor.actor_type.value,
                actor.actor_id,
                BACKFILL_ACTIVITY_SOURCE,
                json.dumps(action.dict()),
                activity.datetime,
                timezone.now(),  # date_updated
                activity_action_idempotency_key(activity),
            ]
        )
        num_entries += 1

    converted_count = bulk_insert_action_log_entries(params, num_entries)

    metrics.incr(
        "issues.backfill_group_action_log.activities_converted",
        amount=converted_count,
    )
    metrics.incr(
        "issues.backfill_group_action_log.activities_skipped",
        amount=skipped_count,
        tags={"reason": "no_action"},
    )
    metrics.incr(
        "issues.backfill_group_action_log.activities_skipped",
        amount=error_count,
        tags={"reason": "translation_error"},
    )

    last_activity = activities[-1]

    logger.info(
        "backfill_group_action_log.batch_complete",
        extra={
            "project_id": project.id,
            "converted_count": converted_count,
            "skipped_count": skipped_count,
            "error_count": error_count,
            "next_cursor_datetime": last_activity.datetime.isoformat(),
            "next_cursor_id": last_activity.id,
        },
    )

    if len(activities) == batch_size:
        backfill_group_action_log_for_project.apply_async(
            kwargs={
                "project_id": project.id,
                "cursor_datetime": last_activity.datetime.isoformat(),
                "cursor_id": last_activity.id,
                "chain_pr_lifecycle": chain_pr_lifecycle,
            },
            countdown=inter_batch_delay_s,
            headers={"sentry-propagate-traces": False},
        )
        if activation_id:
            mark_spawned(_TASK_KEY, activation_id)
    else:
        logger.info(
            "backfill_group_action_log.project_completed",
            extra={"project_id": project.id},
        )
        _complete_project_backfill(project, chain_pr_lifecycle)


def _mark_project_backfill_complete(project: Project) -> None:
    updated = ProjectOption.objects.filter(
        project_id=project.id,
        key=GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION,
        value=False,
    ).update(value=True)
    if updated:
        ProjectOption.objects.reload_cache(
            project.id,
            "group_action_log_backfill.completed",
            GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION,
        )


def _complete_project_backfill(project: Project, chain_pr_lifecycle: bool) -> None:
    _mark_project_backfill_complete(project)

    if chain_pr_lifecycle:
        from sentry.tasks.backfill_pr_lifecycle_action_log import (
            backfill_pr_lifecycle_action_log_for_project,
        )

        backfill_pr_lifecycle_action_log_for_project.delay(project_id=project.id)
    else:
        from sentry.issues.derived.tasks import generate_project_derived_data

        generate_project_derived_data.delay(project_id=project.id)


@instrumented_task(
    name=(
        "sentry.tasks.backfill_group_action_log."
        "enroll_organization_projects_for_group_action_log_backfill"
    ),
    namespace=issues_long_tasks,
    alias_namespace=issues_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def enroll_organization_projects_for_group_action_log_backfill(
    organization_id: int,
    last_project_id: int = 0,
    **kwargs: object,
) -> None:
    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_ORGANIZATION_ENROLLMENT_TASK_KEY, activation_id):
        logger.info(
            "backfill_group_action_log.organization_enrollment.duplicate_redelivery.skipped",
            extra={"activation_id": activation_id, "organization_id": organization_id},
        )
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _ORGANIZATION_ENROLLMENT_TASK_KEY},
        )
        return

    if options.get("issues.backfill_group_action_log.enrollment_killswitch"):
        logger.info("backfill_group_action_log.organization_enrollment.killswitch_enabled")
        return

    batch_size: int = options.get("issues.backfill_group_action_log.enrollment_project_batch_size")
    inter_batch_delay_s: int = options.get(
        "issues.backfill_group_action_log.enrollment_project_inter_batch_delay_s"
    )
    if batch_size <= 0:
        logger.error(
            "backfill_group_action_log.organization_enrollment.invalid_batch_size",
            extra={"batch_size": batch_size, "organization_id": organization_id},
        )
        return

    try:
        organization = Organization.objects.get(id=organization_id, status=ObjectStatus.ACTIVE)
    except Organization.DoesNotExist:
        logger.info(
            "backfill_group_action_log.organization_enrollment.organization_not_found",
            extra={"organization_id": organization_id},
        )
        return

    projects = list(
        Project.objects.filter(
            organization=organization,
            status=ObjectStatus.ACTIVE,
            id__gt=last_project_id,
        )
        .select_related("organization")
        .order_by("id")[:batch_size]
    )
    if not projects:
        logger.info(
            "backfill_group_action_log.organization_enrollment.completed",
            extra={"organization_id": organization_id, "last_project_id": last_project_id},
        )
        return

    eligible_project_ids = [
        project.id for project in projects if features.has(_GROUP_ACTION_LOG_WRITE_FEATURE, project)
    ]

    # Track missing rows so we only invalidate caches for newly enrolled projects.
    project_ids_with_option = set(
        ProjectOption.objects.filter(
            project_id__in=eligible_project_ids,
            key=GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION,
        ).values_list("project_id", flat=True)
    )
    project_ids_to_enroll = [
        project_id
        for project_id in eligible_project_ids
        if project_id not in project_ids_with_option
    ]
    ProjectOption.objects.bulk_create(
        [
            ProjectOption(
                project_id=project_id,
                key=GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION,
                value=False,
            )
            for project_id in project_ids_to_enroll
        ],
        ignore_conflicts=True,
    )
    for project_id in project_ids_to_enroll:
        ProjectOption.objects.reload_cache(
            project_id,
            "group_action_log_backfill.enrollment",
            GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION,
        )

    logger.info(
        "backfill_group_action_log.organization_enrollment.batch_completed",
        extra={
            "organization_id": organization_id,
            "batch_size": len(projects),
            "eligible_projects": len(eligible_project_ids),
            "first_project_id": projects[0].id,
            "last_project_id": projects[-1].id,
        },
    )

    if len(projects) == batch_size:
        enroll_organization_projects_for_group_action_log_backfill.apply_async(
            kwargs={
                "organization_id": organization_id,
                "last_project_id": projects[-1].id,
            },
            countdown=inter_batch_delay_s,
            headers={"sentry-propagate-traces": False},
        )
        if activation_id:
            mark_spawned(_ORGANIZATION_ENROLLMENT_TASK_KEY, activation_id)


@instrumented_task(
    name="sentry.tasks.backfill_group_action_log.enroll_projects_for_group_action_log_backfill",
    namespace=issues_long_tasks,
    alias_namespace=issues_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def enroll_projects_for_group_action_log_backfill(
    last_organization_id: int = 0,
    **kwargs: object,
) -> None:
    """Dispatch project enrollment for active organizations."""
    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_ENROLLMENT_TASK_KEY, activation_id):
        logger.info(
            "backfill_group_action_log.enrollment.duplicate_redelivery.skipped",
            extra={"activation_id": activation_id},
        )
        metrics.incr("taskworker.selfchain.duplicate_skipped", tags={"task": _ENROLLMENT_TASK_KEY})
        return

    if options.get("issues.backfill_group_action_log.enrollment_killswitch"):
        logger.info("backfill_group_action_log.enrollment.killswitch_enabled")
        return

    batch_size: int = options.get(
        "issues.backfill_group_action_log.enrollment_organization_batch_size"
    )
    inter_batch_delay_s: int = options.get(
        "issues.backfill_group_action_log.enrollment_organization_inter_batch_delay_s"
    )
    if batch_size <= 0:
        logger.error(
            "backfill_group_action_log.enrollment.invalid_batch_size",
            extra={"batch_size": batch_size},
        )
        return

    organizations = list(
        Organization.objects.filter(
            status=ObjectStatus.ACTIVE,
            id__gt=last_organization_id,
        ).order_by("id")[:batch_size]
    )
    if not organizations:
        logger.info(
            "backfill_group_action_log.enrollment.completed",
            extra={"last_organization_id": last_organization_id},
        )
        return

    for organization in organizations:
        enroll_organization_projects_for_group_action_log_backfill.apply_async(
            kwargs={"organization_id": organization.id},
            headers={"sentry-propagate-traces": False},
        )

    logger.info(
        "backfill_group_action_log.enrollment.batch_completed",
        extra={
            "batch_size": len(organizations),
            "first_organization_id": organizations[0].id,
            "last_organization_id": organizations[-1].id,
        },
    )

    if len(organizations) == batch_size:
        enroll_projects_for_group_action_log_backfill.apply_async(
            kwargs={"last_organization_id": organizations[-1].id},
            countdown=inter_batch_delay_s,
            headers={"sentry-propagate-traces": False},
        )
        if activation_id:
            mark_spawned(_ENROLLMENT_TASK_KEY, activation_id)


@instrumented_task(
    name="sentry.tasks.backfill_group_action_log.backfill_group_action_log_for_all_projects",
    namespace=issues_long_tasks,
    alias_namespace=issues_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def backfill_group_action_log_for_all_projects(
    project_reset: bool = False,
    last_project_option_id: int = 0,
    **kwargs: object,
) -> None:
    """Dispatch project backfills in batches for projects explicitly marked with a false backfill option."""
    task_state = current_task()
    activation_id = task_state.id if task_state else None
    logger.info(
        "backfill_group_action_log.coordinator.started",
        extra={
            "activation_id": activation_id,
            "last_project_option_id": last_project_option_id,
            "project_reset": project_reset,
        },
    )
    if activation_id and already_spawned(_COORDINATOR_TASK_KEY, activation_id):
        logger.info(
            "backfill_group_action_log.coordinator.duplicate_redelivery.skipped",
            extra={"activation_id": activation_id},
        )
        metrics.incr("taskworker.selfchain.duplicate_skipped", tags={"task": _COORDINATOR_TASK_KEY})
        return

    if options.get("issues.backfill_group_action_log.coordinator_killswitch"):
        logger.info("backfill_group_action_log.coordinator.killswitch_enabled")
        return

    batch_size: int = options.get("issues.backfill_group_action_log.coordinator_batch_size")
    inter_batch_delay_s: int = options.get(
        "issues.backfill_group_action_log.coordinator_inter_batch_delay_s"
    )

    if batch_size <= 0:
        logger.error(
            "backfill_group_action_log.coordinator.invalid_batch_size",
            extra={"batch_size": batch_size},
        )
        return

    logger.info(
        "backfill_group_action_log.coordinator.query_started",
        extra={
            "batch_size": batch_size,
            "last_project_option_id": last_project_option_id,
        },
    )
    query_started_at = time.monotonic()
    project_options = list(
        ProjectOption.objects.filter(
            key=GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION,
            value=False,
            id__gt=last_project_option_id,
        )
        .order_by("id")
        .values_list("id", "project_id")[:batch_size]
    )
    logger.info(
        "backfill_group_action_log.coordinator.query_completed",
        extra={
            "duration_ms": (time.monotonic() - query_started_at) * 1000,
            "incomplete_option_count": len(project_options),
            "option_count": len(project_options),
        },
    )

    if not project_options:
        logger.info(
            "backfill_group_action_log.coordinator.completed",
            extra={"last_project_option_id": last_project_option_id},
        )
        return

    logger.info(
        "backfill_group_action_log.coordinator.dispatch_started",
        extra={"project_count": len(project_options)},
    )
    for _, project_id in project_options:
        backfill_group_action_log_for_project.apply_async(
            kwargs={
                "project_id": project_id,
                "reset": project_reset,
                "chain_pr_lifecycle": True,
            },
            headers={"sentry-propagate-traces": False},
        )

    logger.info(
        "backfill_group_action_log.coordinator.batch_dispatched",
        extra={
            "batch_size": len(project_options),
            "first_project_option_id": project_options[0][0],
            "last_project_option_id": project_options[-1][0],
            "project_reset": project_reset,
            "project_count": len(project_options),
        },
    )

    if len(project_options) == batch_size:
        backfill_group_action_log_for_all_projects.apply_async(
            kwargs={
                "project_reset": project_reset,
                "last_project_option_id": project_options[-1][0],
            },
            countdown=inter_batch_delay_s,
            headers={"sentry-propagate-traces": False},
        )
        logger.info(
            "backfill_group_action_log.coordinator.self_chain_scheduled",
            extra={"last_project_option_id": project_options[-1][0]},
        )
        if activation_id:
            mark_spawned(_COORDINATOR_TASK_KEY, activation_id)
    else:
        logger.info(
            "backfill_group_action_log.coordinator.completed",
            extra={"last_project_option_id": project_options[-1][0]},
        )
