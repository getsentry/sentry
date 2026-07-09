import logging

from sentry import options
from sentry.issues.action_log.types import SYSTEM_ACTOR, ActionSource, GroupActionActor
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics
from sentry.utils.action_log.activity_translator import activity_to_action

logger = logging.getLogger(__name__)


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
    name="sentry.tasks.backfill_group_action_log.backfill_group_action_log_for_org",
    namespace=issues_tasks,
    processing_deadline_duration=15 * 60,
    silo_mode=SiloMode.CELL,
)
def backfill_group_action_log_for_org(
    organization_id: int,
    last_project_id: int = 0,
    last_activity_id: int = 0,
    **kwargs: object,
) -> None:
    if options.get("issues.backfill_group_action_log.killswitch"):
        logger.info("backfill_group_action_log.killswitch_enabled")
        return

    try:
        Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        return

    try:
        _backfill_org(organization_id, last_project_id, last_activity_id)
    except Exception:
        logger.exception(
            "backfill_group_action_log.task_failed",
            extra={
                "organization_id": organization_id,
                "last_project_id": last_project_id,
                "last_activity_id": last_activity_id,
            },
        )
        raise


def _backfill_org(
    organization_id: int,
    last_project_id: int,
    last_activity_id: int,
) -> None:
    batch_size: int = options.get("issues.backfill_group_action_log.batch_size")
    inter_batch_delay_s: int = options.get("issues.backfill_group_action_log.inter_batch_delay_s")

    if batch_size <= 0:
        logger.error(
            "backfill_group_action_log.invalid_batch_size",
            extra={"organization_id": organization_id, "batch_size": batch_size},
        )
        return

    project = (
        Project.objects.filter(
            organization_id=organization_id,
            id__gte=last_project_id or 0,
        )
        .order_by("id")
        .first()
    )

    if not project:
        logger.info(
            "backfill_group_action_log.org_completed",
            extra={"organization_id": organization_id},
        )
        return

    if project.id != last_project_id:
        last_activity_id = 0

    activities = list(
        Activity.objects.filter(
            project_id=project.id,
            id__gt=last_activity_id,
            group_id__isnull=False,
        ).order_by("id")[:batch_size]
    )

    if not activities:
        backfill_group_action_log_for_org.apply_async(
            kwargs={
                "organization_id": organization_id,
                "last_project_id": project.id + 1,
                "last_activity_id": 0,
            },
            countdown=inter_batch_delay_s,
            headers={"sentry-propagate-traces": False},
        )
        return

    logger.info(
        "backfill_group_action_log.batch_starting",
        extra={
            "organization_id": organization_id,
            "project_id": project.id,
            "last_activity_id": last_activity_id,
            "batch_size": len(activities),
            "first_activity_id": activities[0].id,
            "last_activity_id_in_batch": activities[-1].id,
        },
    )

    entries = []
    skipped_count = 0

    for activity in activities:
        try:
            action = activity_to_action(activity)
        except Exception:
            logger.exception(
                "backfill_group_action_log.translation_error",
                extra={"activity_id": activity.id, "activity_type": activity.type},
            )
            skipped_count += 1
            continue
        if action is None:
            skipped_count += 1
            continue

        if activity.user_id is not None:
            actor = GroupActionActor.user(activity.user_id)
        else:
            actor = SYSTEM_ACTOR

        entries.append(
            GroupActionLogEntry(
                group_id=activity.group_id,
                project_id=activity.project_id,
                type=action.get_type().value,
                actor_type=actor.actor_type.value,
                actor_id=actor.actor_id,
                source=ActionSource.UNKNOWN,
                data=action.dict(),
                date_added=activity.datetime,
                idempotency_key=f"activity:{activity.id}",
            )
        )

    if entries:
        GroupActionLogEntry.objects.bulk_create(entries, ignore_conflicts=True)

    # May over-count on re-runs since bulk_create(ignore_conflicts=True)
    # doesn't report actual inserts. Acceptable for a one-time backfill.
    converted_count = len(entries)

    metrics.incr(
        "issues.backfill_group_action_log.activities_converted",
        amount=converted_count,
    )
    metrics.incr(
        "issues.backfill_group_action_log.activities_skipped",
        amount=skipped_count,
        tags={"reason": "no_action"},
    )

    logger.info(
        "backfill_group_action_log.batch_complete",
        extra={
            "organization_id": organization_id,
            "project_id": project.id,
            "converted_count": converted_count,
            "skipped_count": skipped_count,
            "last_activity_id_in_batch": activities[-1].id,
        },
    )

    if len(activities) == batch_size:
        next_project_id = project.id
        next_activity_id = activities[-1].id
    else:
        next_project_id = project.id + 1
        next_activity_id = 0

    backfill_group_action_log_for_org.apply_async(
        kwargs={
            "organization_id": organization_id,
            "last_project_id": next_project_id,
            "last_activity_id": next_activity_id,
        },
        countdown=inter_batch_delay_s,
        headers={"sentry-propagate-traces": False},
    )
