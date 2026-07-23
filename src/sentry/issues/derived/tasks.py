import logging
import time
from datetime import datetime, timedelta, timezone

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

BATCH_PROCESSING_DEADLINE = timedelta(seconds=30)  # taskworker hard kill timeout
BATCH_RETRIGGER_TIMEOUT = timedelta(seconds=20)  # self-reschedule before the hard kill

_BATCH_TASK_KEY = "process_project_derived_data_batch"
_GENERATE_BATCH_TASK_KEY = "generate_project_derived_data_batch"
_GENERATE_GROUP_TASK_KEY = "generate_group_derived_data"

# Cap self-rescheduling rebuilds to avoid infinite loops on very large groups.
_MAX_GENERATION_RUNS = 20
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
    name="sentry.issues.derived.tasks.generate_group_derived_data",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def generate_group_derived_data(
    group_id: int,
    resume_generated_at: str | None = None,
    resume_pipeline_hash: str | None = None,
    prior_runs: int = 0,
    **kwargs: object,
) -> None:
    """Generate derived data for a group by draining its action log."""
    from taskbroker_client.state import current_task

    from sentry.issues.derived.processing import (
        GenerationId,
        GroupLogTimeout,
        PromotionFailed,
        build_and_promote_derived_data,
    )
    from sentry.models.group import Group
    from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned

    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_GENERATE_GROUP_TASK_KEY, activation_id):
        logger.info(
            "generate_group_derived_data.duplicate_skipped",
            extra={"group_id": group_id, "activation_id": activation_id},
        )
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _GENERATE_GROUP_TASK_KEY},
        )
        return

    generation_id: GenerationId | None = None
    if resume_generated_at is not None and resume_pipeline_hash is not None:
        generation_id = GenerationId(
            group_id,
            datetime.fromisoformat(resume_generated_at).replace(tzinfo=timezone.utc),
            resume_pipeline_hash,
        )

    try:
        build_and_promote_derived_data(
            group_id, generation_id=generation_id, time_limit=BATCH_RETRIGGER_TIMEOUT
        )
    except Group.DoesNotExist:
        logger.info("generate_group_derived_data.group_not_found", extra={"group_id": group_id})
        return
    except PromotionFailed:
        logger.exception("generate_group_derived_data.promotion_failed")
        return
    except GroupLogTimeout as e:
        if prior_runs + 1 >= _MAX_GENERATION_RUNS:
            logger.error(
                "generate_group_derived_data.max_runs_exceeded",
                extra={
                    "group_id": group_id,
                    "generation_id": e.generation_id,
                    "prior_runs": prior_runs + 1,
                },
            )
            metrics.incr("issues.derived.generate_max_runs_exceeded", sample_rate=1.0)
            return
        gen_id = e.generation_id
        generate_group_derived_data.delay(
            group_id,
            resume_generated_at=gen_id.generated_at.isoformat() if gen_id else None,
            resume_pipeline_hash=gen_id.pipeline_hash if gen_id else None,
            prior_runs=prior_runs + 1,
        )
        if activation_id:
            mark_spawned(_GENERATE_GROUP_TASK_KEY, activation_id)


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
        .exclude(Exists(GroupDerivedData.objects.filter(group_id=OuterRef("id"))))
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
        remaining = timedelta(seconds=max(0, timeout_seconds - (time.monotonic() - start)))
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
# Project-level generation: build-and-promote for all groups
# ---------------------------------------------------------------------------


@instrumented_task(
    name="sentry.issues.derived.tasks.generate_project_derived_data",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def generate_project_derived_data(project_id: int, **kwargs: object) -> None:
    """Generate derived data for every group in a project.

    Partitions groups into ID ranges and fans out a batch task for each
    range. Each batch calls ``build_and_promote_derived_data`` per group,
    which replaces existing rows via CAS while they continue serving reads.
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
            "generate_project_derived_data.too_many_groups",
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
            "generate_project_derived_data.too_many_tasks",
            extra={
                "project_id": project_id,
                "task_count": len(ranges),
                "max_tasks": max_tasks,
            },
        )
        return

    for start, end in ranges:
        generate_project_derived_data_batch.delay(
            project_id=project_id,
            group_id_start=start,
            group_id_end=end,
        )

    logger.info(
        "generate_project_derived_data.scheduled",
        extra={
            "project_id": project_id,
            "group_count": len(group_ids),
            "task_count": len(ranges),
        },
    )


@instrumented_task(
    name="sentry.issues.derived.tasks.generate_project_derived_data_batch",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=int(BATCH_PROCESSING_DEADLINE.total_seconds()),
)
def generate_project_derived_data_batch(
    project_id: int,
    group_id_start: int,
    group_id_end: int,
    resume_generated_at: str | None = None,
    resume_pipeline_hash: str | None = None,
    **kwargs: object,
) -> None:
    """Generate derived data for groups in [group_id_start, group_id_end).

    Calls build_and_promote_derived_data for each group. Reschedules the
    remaining range on per-group or batch timeout. On per-group timeout,
    the generation_id is passed through so the next run resumes from
    cached partial progress.
    """
    from taskbroker_client.state import current_task

    from sentry.issues.derived.processing import (
        GenerationId,
        GroupLogTimeout,
        PromotionFailed,
        build_and_promote_derived_data,
    )
    from sentry.models.group import Group
    from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned

    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_GENERATE_BATCH_TASK_KEY, activation_id):
        logger.info(
            "generate_project_derived_data_batch.duplicate_skipped",
            extra={"project_id": project_id, "activation_id": activation_id},
        )
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _GENERATE_BATCH_TASK_KEY},
        )
        return

    # Reconstruct generation_id for resuming the first group from cache.
    generation_id: GenerationId | None = None
    if resume_generated_at is not None and resume_pipeline_hash is not None:
        generation_id = GenerationId(
            group_id_start,
            datetime.fromisoformat(resume_generated_at).replace(tzinfo=timezone.utc),
            resume_pipeline_hash,
        )

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

    processed: dict[str, int] = {}
    rescheduled = False

    for group_id in group_ids:
        remaining = timedelta(seconds=max(0, timeout_seconds - (time.monotonic() - start)))
        try:
            build_and_promote_derived_data(
                group_id,
                generation_id=generation_id if group_id == group_id_start else None,
                time_limit=remaining,
            )
            processed["promoted"] = processed.get("promoted", 0) + 1
        except Group.DoesNotExist:
            logger.info(
                "generate_project_derived_data_batch.group_not_found",
                extra={"group_id": group_id, "project_id": project_id},
            )
        except PromotionFailed as e:
            processed[e.result.value] = processed.get(e.result.value, 0) + 1
            logger.exception("generate_project_derived_data_batch.promotion_failed")
        except GroupLogTimeout as e:
            rescheduled = True
            gen_id = e.generation_id
            metrics.incr(
                "issues.derived.generate_batch_rescheduled",
                sample_rate=1.0,
                tags={"reason": "group_timeout"},
            )
            generate_project_derived_data_batch.delay(
                project_id=project_id,
                group_id_start=group_id,
                group_id_end=group_id_end,
                resume_generated_at=gen_id.generated_at.isoformat() if gen_id else None,
                resume_pipeline_hash=gen_id.pipeline_hash if gen_id else None,
            )
            if activation_id:
                mark_spawned(_GENERATE_BATCH_TASK_KEY, activation_id)
            break

        if time.monotonic() - start >= timeout_seconds:
            rescheduled = True
            metrics.incr(
                "issues.derived.generate_batch_rescheduled",
                sample_rate=1.0,
                tags={"reason": "batch_timeout"},
            )
            generate_project_derived_data_batch.delay(
                project_id=project_id,
                group_id_start=group_id + 1,
                group_id_end=group_id_end,
            )
            if activation_id:
                mark_spawned(_GENERATE_BATCH_TASK_KEY, activation_id)
            break

    for result, count in processed.items():
        metrics.incr(
            "issues.derived.generate_project_groups_processed",
            amount=count,
            sample_rate=1.0,
            tags={"result": result},
        )
    logger.info(
        "generate_project_derived_data_batch.complete",
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
