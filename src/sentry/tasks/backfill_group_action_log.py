import logging
from datetime import datetime

from taskbroker_client.state import current_task

from sentry import options
from sentry.issues.action_log.backfill import (
    BACKFILL_ACTIVITY_SOURCE,
    bulk_insert_action_log_entries,
)
from sentry.issues.action_log.types import SYSTEM_ACTOR, GroupActionActor
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.utils import json, metrics
from sentry.utils.action_log.activity_translator import (
    activity_action_idempotency_key,
    activity_to_action,
)

logger = logging.getLogger(__name__)

_TASK_KEY = "backfill_group_action_log_for_project"


@instrumented_task(
    name="sentry.tasks.backfill_group_action_log.backfill_group_action_log_for_group",
    namespace=issues_tasks,
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
    namespace=issues_tasks,
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
    namespace=issues_tasks,
    processing_deadline_duration=15 * 60,
    silo_mode=SiloMode.CELL,
)
def backfill_group_action_log_for_project(
    project_id: int,
    last_activity_id: int = 0,
    cursor_datetime: str | None = None,
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

    parsed_cursor = datetime.fromisoformat(cursor_datetime) if cursor_datetime else None

    try:
        _backfill_project(project, parsed_cursor, activation_id)
    except Exception:
        logger.exception(
            "backfill_group_action_log.task_failed",
            extra={
                "project_id": project_id,
                "cursor_datetime": cursor_datetime,
            },
        )
        raise


def _backfill_project(
    project: Project,
    cursor_dt: datetime | None,
    activation_id: str | None = None,
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
        # gte not gt: may re-fetch the last row from the previous batch, but the
        # idempotency key (ON CONFLICT DO NOTHING) makes that a no-op. Avoids
        # skipping rows that share a timestamp at the batch boundary.
        qs = qs.filter(datetime__gte=cursor_dt)
    activities = list(qs.order_by("datetime")[:batch_size])

    if not activities:
        logger.info(
            "backfill_group_action_log.project_completed",
            extra={"project_id": project.id},
        )
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
                activity.datetime,  # date_updated
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

    next_cursor = activities[-1].datetime.isoformat()

    logger.info(
        "backfill_group_action_log.batch_complete",
        extra={
            "project_id": project.id,
            "converted_count": converted_count,
            "skipped_count": skipped_count,
            "error_count": error_count,
            "next_cursor_datetime": next_cursor,
        },
    )

    if len(activities) == batch_size:
        backfill_group_action_log_for_project.apply_async(
            kwargs={
                "project_id": project.id,
                "cursor_datetime": next_cursor,
            },
            countdown=inter_batch_delay_s,
            headers={"sentry-propagate-traces": False},
        )
        if activation_id:
            mark_spawned(_TASK_KEY, activation_id)
