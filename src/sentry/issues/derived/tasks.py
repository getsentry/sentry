import logging
import time
from datetime import timedelta

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

BATCH_PROCESSING_DEADLINE = timedelta(seconds=30)  # taskworker hard kill timeout
BATCH_RETRIGGER_TIMEOUT = timedelta(seconds=20)  # self-reschedule before the hard kill

_BATCH_TASK_KEY = "process_project_derived_data_batch"
_REBUILD_BATCH_TASK_KEY = "rebuild_project_derived_data_batch"
_REBUILD_GROUP_TASK_KEY = "rebuild_group_derived_data"

# Cap self-rescheduling rebuilds to avoid infinite loops on very large groups.
_MAX_REBUILD_RUNS = 20
# Hard limit on group IDs loaded per project-level task to bound memory.
_MAX_PROJECT_GROUPS = 10_000


@instrumented_task(
    name="sentry.issues.derived.tasks.process_group_log_task",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def process_group_log_task(group_id: int, **kwargs: object) -> None:
    """Drain all pending action log entries for a single group into its derived data."""
    from sentry.issues.derived.processing import process_group_log
    from sentry.models.group import Group

    try:
        process_group_log(group_id)
    except Group.DoesNotExist:
        logger.info("process_group_log_task.group_not_found", extra={"group_id": group_id})


@instrumented_task(
    name="sentry.issues.derived.tasks.rebuild_group_derived_data",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def rebuild_group_derived_data(
    group_id: int,
    derived_id: int | None = None,
    prior_runs: int = 0,
    **kwargs: object,
) -> None:
    """Build a new GroupDerivedData row from scratch and promote it to live."""
    from taskbroker_client.state import current_task

    from sentry.issues.derived.processing import GroupLogTimeout, build_and_promote_derived_data
    from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned

    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_REBUILD_GROUP_TASK_KEY, activation_id):
        logger.info(
            "rebuild_group_derived_data.duplicate_skipped",
            extra={"group_id": group_id, "activation_id": activation_id},
        )
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _REBUILD_GROUP_TASK_KEY},
        )
        return

    try:
        build_and_promote_derived_data(group_id, derived_id=derived_id)
    except GroupLogTimeout as e:
        if prior_runs + 1 >= _MAX_REBUILD_RUNS:
            logger.error(
                "rebuild_group_derived_data.max_runs_exceeded",
                extra={
                    "group_id": group_id,
                    "derived_id": e.derived_id,
                    "prior_runs": prior_runs + 1,
                },
            )
            metrics.incr("issues.derived.rebuild_max_runs_exceeded", sample_rate=1.0)
            return
        rebuild_group_derived_data.delay(
            group_id, derived_id=e.derived_id, prior_runs=prior_runs + 1
        )
        if activation_id:
            mark_spawned(_REBUILD_GROUP_TASK_KEY, activation_id)


@instrumented_task(
    name="sentry.issues.derived.tasks.process_project_derived_data",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def process_project_derived_data(project_id: int, **kwargs: object) -> None:
    """Build derived data for all unprocessed groups in a project.

    Finds groups without a GroupDerivedData row, partitions them into
    ID ranges, and fans out a batch task for each range.
    """
    from django.db.models import Exists, OuterRef

    from sentry import options
    from sentry.issues.models.groupderiveddata import GroupDerivedData
    from sentry.models.group import Group

    batch_size = options.get("issues.derived.project-batch-size")
    max_tasks = options.get("issues.derived.project-max-tasks")

    # TODO: support very large projects via paginated iteration
    group_ids = list(
        Group.objects.filter(project_id=project_id)
        .exclude(Exists(GroupDerivedData.objects.filter(group_id=OuterRef("id"), is_live=True)))
        .order_by("id")
        .values_list("id", flat=True)[:_MAX_PROJECT_GROUPS]
    )

    if not group_ids:
        logger.info(
            "process_project_derived_data.all_groups_covered",
            extra={"project_id": project_id},
        )
        return

    if len(group_ids) >= _MAX_PROJECT_GROUPS:
        logger.error(
            "process_project_derived_data.too_many_groups",
            extra={
                "project_id": project_id,
                "limit": _MAX_PROJECT_GROUPS,
            },
        )

    starts = [group_ids[i] for i in range(0, len(group_ids), batch_size)]
    ends = starts[1:] + [group_ids[-1] + 1]
    ranges = list(zip(starts, ends))

    if len(ranges) > max_tasks:
        logger.error(
            "process_project_derived_data.too_many_tasks",
            extra={
                "project_id": project_id,
                "task_count": len(ranges),
                "max_tasks": max_tasks,
            },
        )
        return

    for start, end in ranges:
        process_project_derived_data_batch.delay(
            project_id=project_id,
            group_id_start=start,
            group_id_end=end,
        )

    logger.info(
        "process_project_derived_data.scheduled",
        extra={
            "project_id": project_id,
            "group_count": len(group_ids),
            "task_count": len(ranges),
        },
    )


@instrumented_task(
    name="sentry.issues.derived.tasks.process_project_derived_data_batch",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=int(BATCH_PROCESSING_DEADLINE.total_seconds()),
)
def process_project_derived_data_batch(
    project_id: int,
    group_id_start: int,
    group_id_end: int,
    **kwargs: object,
) -> None:
    """Process derived data for groups in the ID range [group_id_start, group_id_end).

    Reschedules itself with the remaining range if the timeout is reached.
    """
    from taskbroker_client.state import current_task

    from sentry.issues.derived.processing import GroupLogTimeout, process_group_log
    from sentry.models.group import Group
    from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned

    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_BATCH_TASK_KEY, activation_id):
        logger.info(
            "process_project_derived_data_batch.duplicate_skipped",
            extra={"project_id": project_id, "activation_id": activation_id},
        )
        metrics.incr("taskworker.selfchain.duplicate_skipped", tags={"task": _BATCH_TASK_KEY})
        return

    timeout_seconds = BATCH_RETRIGGER_TIMEOUT.total_seconds()
    start = time.monotonic()

    group_ids = list(
        Group.objects.filter(
            project_id=project_id,
            id__gte=group_id_start,
            id__lt=group_id_end,
        )
        .order_by("id")
        .values_list("id", flat=True)
    )

    processed = 0
    rescheduled = False

    for group_id in group_ids:
        remaining = timedelta(seconds=timeout_seconds - (time.monotonic() - start))
        try:
            process_group_log(group_id, timeout=remaining)
            processed += 1
        except Group.DoesNotExist:
            logger.info(
                "process_project_derived_data_batch.group_not_found",
                extra={"group_id": group_id, "project_id": project_id},
            )
        except GroupLogTimeout:
            rescheduled = True
            metrics.incr(
                "issues.derived.batch_rescheduled",
                sample_rate=1.0,
                tags={"reason": "group_timeout"},
            )
            process_project_derived_data_batch.delay(
                project_id=project_id,
                group_id_start=group_id,
                group_id_end=group_id_end,
            )
            if activation_id:
                mark_spawned(_BATCH_TASK_KEY, activation_id)
            break

        if time.monotonic() - start >= timeout_seconds:
            rescheduled = True
            metrics.incr(
                "issues.derived.batch_rescheduled",
                sample_rate=1.0,
                tags={"reason": "batch_timeout"},
            )
            process_project_derived_data_batch.delay(
                project_id=project_id,
                group_id_start=group_id + 1,
                group_id_end=group_id_end,
            )
            if activation_id:
                mark_spawned(_BATCH_TASK_KEY, activation_id)
            break

    metrics.incr(
        "issues.derived.project_groups_processed",
        amount=processed,
        sample_rate=1.0,
    )
    logger.info(
        "process_project_derived_data_batch.complete",
        extra={
            "project_id": project_id,
            "group_id_start": group_id_start,
            "group_id_end": group_id_end,
            "processed": processed,
            "total": len(group_ids),
            "rescheduled": rescheduled,
            "elapsed": time.monotonic() - start,
        },
    )


# ---------------------------------------------------------------------------
# Project-level rebuild: build-and-promote without deleting existing live rows
# ---------------------------------------------------------------------------


@instrumented_task(
    name="sentry.issues.derived.tasks.rebuild_project_derived_data",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def rebuild_project_derived_data(project_id: int, **kwargs: object) -> None:
    """Rebuild derived data for all groups in a project via build-and-promote.

    Unlike process_project_derived_data (which only targets groups missing a
    GDD row), this task covers every group in the project — creating derived
    data where missing and replacing existing live rows with freshly built ones.
    Existing live rows continue serving reads until each replacement is promoted.
    """
    from sentry import options
    from sentry.models.group import Group

    batch_size = options.get("issues.derived.project-batch-size")
    max_tasks = options.get("issues.derived.project-max-tasks")

    # TODO: support very large projects via paginated iteration
    group_ids = list(
        Group.objects.filter(project_id=project_id)
        .order_by("id")
        .values_list("id", flat=True)[:_MAX_PROJECT_GROUPS]
    )

    if not group_ids:
        return

    if len(group_ids) >= _MAX_PROJECT_GROUPS:
        logger.error(
            "rebuild_project_derived_data.too_many_groups",
            extra={
                "project_id": project_id,
                "limit": _MAX_PROJECT_GROUPS,
            },
        )

    starts = [group_ids[i] for i in range(0, len(group_ids), batch_size)]
    ends = starts[1:] + [group_ids[-1] + 1]
    ranges = list(zip(starts, ends))

    if len(ranges) > max_tasks:
        logger.error(
            "rebuild_project_derived_data.too_many_tasks",
            extra={
                "project_id": project_id,
                "task_count": len(ranges),
                "max_tasks": max_tasks,
            },
        )
        return

    for start, end in ranges:
        rebuild_project_derived_data_batch.delay(
            project_id=project_id,
            group_id_start=start,
            group_id_end=end,
        )

    logger.info(
        "rebuild_project_derived_data.scheduled",
        extra={
            "project_id": project_id,
            "group_count": len(group_ids),
            "task_count": len(ranges),
        },
    )


@instrumented_task(
    name="sentry.issues.derived.tasks.rebuild_project_derived_data_batch",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=int(BATCH_PROCESSING_DEADLINE.total_seconds()),
)
def rebuild_project_derived_data_batch(
    project_id: int,
    group_id_start: int,
    group_id_end: int,
    **kwargs: object,
) -> None:
    """Rebuild derived data for groups in [group_id_start, group_id_end).

    Calls build_and_promote_derived_data for each group. On per-group
    GroupLogTimeout, re-enqueues the individual group for resumption and
    continues the batch. Reschedules the remaining range on batch timeout.
    """
    from taskbroker_client.state import current_task

    from sentry.issues.derived.processing import GroupLogTimeout, build_and_promote_derived_data
    from sentry.models.group import Group
    from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned

    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_REBUILD_BATCH_TASK_KEY, activation_id):
        logger.info(
            "rebuild_project_derived_data_batch.duplicate_skipped",
            extra={"project_id": project_id, "activation_id": activation_id},
        )
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _REBUILD_BATCH_TASK_KEY},
        )
        return

    timeout_seconds = BATCH_RETRIGGER_TIMEOUT.total_seconds()
    start = time.monotonic()

    group_ids = list(
        Group.objects.filter(
            project_id=project_id,
            id__gte=group_id_start,
            id__lt=group_id_end,
        )
        .order_by("id")
        .values_list("id", flat=True)
    )

    processed = 0
    rescheduled = False

    for group_id in group_ids:
        remaining = timedelta(seconds=timeout_seconds - (time.monotonic() - start))
        try:
            build_and_promote_derived_data(group_id, time_limit=remaining)
        except GroupLogTimeout as e:
            # Re-enqueue the single group with its id so the
            # partially-drained row is resumed, then continue the batch.
            rebuild_group_derived_data.delay(group_id, derived_id=e.derived_id)
        processed += 1

        if time.monotonic() - start >= timeout_seconds:
            rescheduled = True
            metrics.incr(
                "issues.derived.rebuild_batch_rescheduled",
                sample_rate=1.0,
                tags={"reason": "batch_timeout"},
            )
            rebuild_project_derived_data_batch.delay(
                project_id=project_id,
                group_id_start=group_id + 1,
                group_id_end=group_id_end,
            )
            if activation_id:
                mark_spawned(_REBUILD_BATCH_TASK_KEY, activation_id)
            break

    metrics.incr(
        "issues.derived.rebuild_project_groups_processed",
        amount=processed,
        sample_rate=1.0,
    )
    logger.info(
        "rebuild_project_derived_data_batch.complete",
        extra={
            "project_id": project_id,
            "group_id_start": group_id_start,
            "group_id_end": group_id_end,
            "processed": processed,
            "total": len(group_ids),
            "rescheduled": rescheduled,
            "elapsed": time.monotonic() - start,
        },
    )
