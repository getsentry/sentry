from __future__ import annotations

import logging
import time
from collections.abc import Sequence
from datetime import timedelta
from typing import TYPE_CHECKING

from django.db.models import Exists, OuterRef

from sentry.silo.base import SiloMode

if TYPE_CHECKING:
    from sentry.db.models.manager.base_query_set import BaseQuerySet
    from sentry.issues.derived.heal import RegenerationRequest
    from sentry.models.group import Group

from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

BATCH_PROCESSING_DEADLINE = timedelta(seconds=30)  # taskworker hard kill timeout
BATCH_RETRIGGER_TIMEOUT = timedelta(seconds=20)  # self-reschedule before the hard kill

_GENERATE_PROJECT_TASK_KEY = "generate_project_derived_data"
_GENERATE_BATCH_TASK_KEY = "generate_project_derived_data_batch"
_REGENERATE_STALE_BATCH_TASK_KEY = "regenerate_stale_derived_data_batch"
_CHECK_FRESH_BATCH_TASK_KEY = "check_fresh_derived_data_batch"
_GENERATE_GROUP_TASK_KEY = "generate_group_derived_data"

# Cap self-rescheduling rebuilds to avoid infinite loops on very large groups.
_MAX_GENERATION_RUNS = 20
_MAX_CHECK_RUNS = 20
# Maximum group IDs loaded by one project-level task invocation.
_MAX_PROJECT_GROUPS = 10_000


def _stale_pipeline_filter(qs: BaseQuerySet[Group], pipeline_hash: str) -> BaseQuerySet[Group]:
    """Filter a Group queryset to only groups with a stale or NULL pipeline_hash."""
    from sentry.issues.models.groupderiveddata import GroupDerivedData

    return qs.filter(
        Exists(
            GroupDerivedData.objects.filter(
                group_id=OuterRef("id"),
            ).exclude(
                pipeline_hash=pipeline_hash,
            )
        )
    )


def _chunk_group_ids_into_ranges(
    group_ids: Sequence[int], batch_size: int
) -> list[tuple[int, int]]:
    """Partition a sorted list of group IDs into ``[start, end)`` ranges of up to ``batch_size``."""
    if not group_ids:
        return []
    starts = [group_ids[i] for i in range(0, len(group_ids), batch_size)]
    ends = starts[1:] + [group_ids[-1] + 1]
    return list(zip(starts, ends))


@instrumented_task(
    name="sentry.issues.derived.tasks.process_group_log_task",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def process_group_log_task(group_id: int, incremental: bool = False, **kwargs: object) -> None:
    """Drain all pending action log entries for a single group into its derived data."""
    logger.info(
        "process_group_log_task.started",
        extra={"group_id": group_id, "incremental": incremental},
    )
    from sentry.issues.derived.processing import (
        DerivedMetrics,
        ProcessingStrategy,
        process_group_log,
    )
    from sentry.models.group import Group

    derived_metrics = DerivedMetrics(mode=ProcessingStrategy.ASYNC, incremental=incremental)
    try:
        process_group_log(group_id, derived_metrics=derived_metrics)
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
    logger.info(
        "generate_group_derived_data.started",
        extra={"group_id": group_id, "prior_runs": prior_runs},
    )
    from taskbroker_client.state import current_task

    from sentry.issues.derived.processing import GroupLogTimeout
    from sentry.issues.derived.promote import PromotionFailed, build_and_promote_derived_data
    from sentry.issues.derived.tasks_util import _resume_generation_id
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

    generation_id = _resume_generation_id(group_id, resume_generated_at, resume_pipeline_hash)

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
    name="sentry.issues.derived.tasks.generate_project_derived_data",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def generate_project_derived_data(
    project_id: int,
    cursor_group_id: int = 0,
    *,
    stale_only: bool = False,
    **kwargs: object,
) -> None:
    """Generate derived data for groups in a project via build-and-promote.

    Pages through group IDs and fans out ``build_and_promote_derived_data``
    batches, which replace existing rows via CAS without deleting them.

    When *stale_only* is True, only groups with a ``GroupDerivedData``
    row whose ``pipeline_hash`` is outdated or NULL are included.
    Groups without a row are not affected.
    """
    logger.info(
        "generate_project_derived_data.started",
        extra={
            "project_id": project_id,
            "cursor_group_id": cursor_group_id,
            "stale_only": stale_only,
        },
    )
    from taskbroker_client.state import current_task

    from sentry import options
    from sentry.issues.derived.processing import PIPELINE
    from sentry.issues.derived.tasks_util import SpawnState
    from sentry.models.group import Group

    spawn = SpawnState(current_task(), _GENERATE_PROJECT_TASK_KEY)
    if spawn.already_spawned():
        logger.info(
            "generate_project_derived_data.duplicate_redelivery.skipped",
            extra={"project_id": project_id, "activation_id": spawn.activation_id},
        )
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": spawn.task_key},
        )
        return

    batch_size = options.get("issues.derived.project-batch-size")
    max_tasks = options.get("issues.derived.project-max-tasks")

    page_size = min(_MAX_PROJECT_GROUPS, batch_size * max_tasks)
    if page_size <= 0:
        logger.error(
            "generate_project_derived_data.invalid_batch_configuration",
            extra={"batch_size": batch_size, "max_tasks": max_tasks},
        )
        return

    qs = Group.objects.filter(project_id=project_id, id__gt=cursor_group_id)
    if stale_only:
        qs = _stale_pipeline_filter(qs, PIPELINE.pipeline_hash)
    group_ids = list(qs.order_by("id").values_list("id", flat=True)[: page_size + 1])

    if not group_ids:
        return

    has_more = len(group_ids) > page_size
    group_ids = group_ids[:page_size]
    next_cursor_group_id = group_ids[-1] if has_more else None

    ranges = _chunk_group_ids_into_ranges(group_ids, batch_size)

    for start, end in ranges:
        generate_project_derived_data_batch.delay(
            project_id=project_id,
            group_id_start=start,
            group_id_end=end,
            stale_only=stale_only,
        )

    if next_cursor_group_id is not None:
        # Check just before self-spawn and mark after: narrowest race window without going
        # at-most-once. Still best-effort — concurrent deliveries can both pass this check and
        # double-spawn; we only shrink the window so that is less likely.
        if spawn.already_spawned():
            logger.info(
                "generate_project_derived_data.duplicate_redelivery.skipped_before_spawn",
                extra={"project_id": project_id, "activation_id": spawn.activation_id},
            )
            metrics.incr(
                "taskworker.selfchain.duplicate_skipped",
                tags={"task": spawn.task_key},
            )
        else:
            generate_project_derived_data.apply_async(
                kwargs={
                    "project_id": project_id,
                    "cursor_group_id": next_cursor_group_id,
                    "stale_only": stale_only,
                },
                headers={"sentry-propagate-traces": False},
            )
            spawn.mark_spawned()

    logger.info(
        "generate_project_derived_data.scheduled",
        extra={
            "project_id": project_id,
            "group_count": len(group_ids),
            "task_count": len(ranges),
            "next_cursor_group_id": next_cursor_group_id,
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
    *,
    stale_only: bool = False,
    **kwargs: object,
) -> None:
    """Generate derived data for groups in [group_id_start, group_id_end).

    Calls build_and_promote_derived_data for each group. Reschedules the
    remaining range on per-group or batch timeout. On per-group timeout,
    the generation_id is passed through so the next run resumes from
    cached partial progress.

    When *stale_only* is True, only groups with a ``GroupDerivedData``
    row whose ``pipeline_hash`` is outdated or NULL are processed.
    """
    logger.info(
        "generate_project_derived_data_batch.started",
        extra={
            "project_id": project_id,
            "group_id_start": group_id_start,
            "group_id_end": group_id_end,
            "stale_only": stale_only,
        },
    )
    from taskbroker_client.state import current_task

    from sentry.issues.derived.processing import PIPELINE
    from sentry.issues.derived.promote import build_and_promote_batch
    from sentry.issues.derived.tasks_util import _record_batch_metrics, _resume_generation_id
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
    generation_id = _resume_generation_id(group_id_start, resume_generated_at, resume_pipeline_hash)

    start = time.monotonic()

    qs = Group.objects.filter(
        project_id=project_id,
        id__gte=group_id_start,
        id__lt=group_id_end,
    )
    if stale_only:
        qs = _stale_pipeline_filter(qs, PIPELINE.pipeline_hash)
    group_ids = list(qs.order_by("id").values_list("id", flat=True))

    result = build_and_promote_batch(
        group_ids,
        timeout=BATCH_RETRIGGER_TIMEOUT,
        initial_generation_id=generation_id,
        log_key="generate_project_derived_data_batch",
        project_id=project_id,
    )

    rescheduled = False
    if result.timeout_reason is not None:
        rescheduled = True
        metrics.incr(
            "issues.derived.generate_batch_rescheduled",
            sample_rate=1.0,
            tags={"reason": result.timeout_reason},
        )
        assert result.resume_from_group_id is not None
        gen_id = result.resume_generation_id
        generate_project_derived_data_batch.delay(
            project_id=project_id,
            group_id_start=result.resume_from_group_id,
            group_id_end=group_id_end,
            resume_generated_at=gen_id.generated_at.isoformat() if gen_id else None,
            resume_pipeline_hash=gen_id.pipeline_hash if gen_id else None,
            stale_only=stale_only,
        )
        if activation_id:
            mark_spawned(_GENERATE_BATCH_TASK_KEY, activation_id)

    _record_batch_metrics(
        result.processed,
        metric_name="issues.derived.generate_project_groups_processed",
    )
    logger.info(
        "generate_project_derived_data_batch.complete",
        extra={
            "project_id": project_id,
            "group_id_start": group_id_start,
            "group_id_end": group_id_end,
            "processed": {r.value: c for r, c in result.processed.items()},
            "total": len(group_ids),
            "rescheduled": rescheduled,
            "elapsed": time.monotonic() - start,
        },
    )


# ---------------------------------------------------------------------------
# Self-healing: rebuild groups with outdated pipeline hashes
# ---------------------------------------------------------------------------


def _enqueue_regeneration(request: RegenerationRequest) -> None:
    regenerate_stale_derived_data_batch.delay(
        target_hash=request.target_hash,
        group_id_start=request.group_id_start,
        group_id_end=request.group_id_end,
        resume_generated_at=request.resume_generated_at,
        resume_pipeline_hash=request.resume_pipeline_hash,
        rows_found_before=request.rows_found_before,
        range_overflowed=request.range_overflowed,
    )


def _enqueue_fresh_check(group_id_start: int, group_id_end: int) -> None:
    check_fresh_derived_data_batch.delay(
        group_id_start=group_id_start,
        group_id_end=group_id_end,
    )


@instrumented_task(
    name="sentry.issues.derived.tasks.heal_stale_derived_data",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=120,
)
def heal_stale_derived_data(**kwargs: object) -> None:
    """Schedule healing for outdated and explicitly invalidated derived data."""
    from sentry.issues.derived.heal import heal_stale_derived_data as heal

    heal(enqueue_regeneration=_enqueue_regeneration, enqueue_check=_enqueue_fresh_check)


@instrumented_task(
    name="sentry.issues.derived.tasks.check_fresh_derived_data_batch",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=int(BATCH_PROCESSING_DEADLINE.total_seconds()),
)
def check_fresh_derived_data_batch(
    group_id_start: int,
    group_id_end: int,
    resume_check_id: str | None = None,
    resume_generated_at: str | None = None,
    resume_cursor_date: str | None = None,
    resume_cursor_id: int | None = None,
    resume_pipeline_hash: str | None = None,
    prior_runs: int = 0,
    **kwargs: object,
) -> None:
    """Check fresh GroupDerivedData rows in ``[group_id_start, group_id_end)``."""
    logger.info(
        "check_fresh_derived_data_batch.started",
        extra={
            "group_id_start": group_id_start,
            "group_id_end": group_id_end,
            "prior_runs": prior_runs,
        },
    )
    from taskbroker_client.state import current_task

    from sentry import options
    from sentry.issues.derived.check import (
        CheckInvalidated,
        CheckTimeout,
        check_derived_data,
        record_batch_status_consistency,
    )
    from sentry.issues.derived.processing import PIPELINE
    from sentry.issues.derived.tasks_util import _record_check_result, _resume_check_id
    from sentry.issues.models.groupderiveddata import GroupDerivedData
    from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned

    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_CHECK_FRESH_BATCH_TASK_KEY, activation_id):
        logger.info(
            "check_fresh_derived_data_batch.duplicate_skipped",
            extra={"group_id_start": group_id_start, "activation_id": activation_id},
        )
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _CHECK_FRESH_BATCH_TASK_KEY},
        )
        return

    check_id = _resume_check_id(
        group_id_start,
        resume_check_id,
        resume_generated_at,
        resume_cursor_date,
        resume_cursor_id,
        resume_pipeline_hash,
    )

    status_check_enabled = options.get("issues.derived.status-consistency-check-enabled")
    project_should_check: dict[int, bool] = {}
    derived_rows = GroupDerivedData.objects.filter(
        pipeline_hash=PIPELINE.pipeline_hash,
        group_id__gte=group_id_start,
        group_id__lt=group_id_end,
    ).order_by("group_id")
    if status_check_enabled:
        derived_rows = derived_rows.select_related("group")
    start = time.monotonic()
    timeout_seconds = BATCH_RETRIGGER_TIMEOUT.total_seconds()
    for derived in derived_rows.iterator():
        if status_check_enabled:
            record_batch_status_consistency(derived, derived.group, project_should_check)
        remaining = timedelta(seconds=max(0, timeout_seconds - (time.monotonic() - start)))
        try:
            result = check_derived_data(
                derived,
                PIPELINE,
                timeout=remaining,
                check_id=(check_id if derived.group_id == group_id_start else None),
            )
        except CheckTimeout as error:
            group_prior_runs = prior_runs if derived.group_id == group_id_start else 0
            if group_prior_runs + 1 >= _MAX_CHECK_RUNS:
                logger.error(
                    "check_fresh_derived_data_batch.max_runs_exceeded",
                    extra={"group_id": derived.group_id, "check_id": error.check_id},
                )
                _record_check_result(CheckInvalidated())
                check_fresh_derived_data_batch.delay(
                    group_id_start=derived.group_id + 1,
                    group_id_end=group_id_end,
                )
                if activation_id:
                    mark_spawned(_CHECK_FRESH_BATCH_TASK_KEY, activation_id)
                return

            check_fresh_derived_data_batch.delay(
                group_id_start=derived.group_id,
                group_id_end=group_id_end,
                resume_check_id=error.check_id.invocation_id,
                resume_generated_at=error.check_id.generated_at.isoformat(),
                resume_cursor_date=error.check_id.cursor_date.isoformat(),
                resume_cursor_id=error.check_id.cursor_id,
                resume_pipeline_hash=error.check_id.pipeline_hash,
                prior_runs=group_prior_runs + 1,
            )
            metrics.incr(
                "issues.derived.check_fresh_batch_rescheduled",
                sample_rate=1.0,
                tags={"reason": "group_timeout"},
            )
            if activation_id:
                mark_spawned(_CHECK_FRESH_BATCH_TASK_KEY, activation_id)
            return

        _record_check_result(result)
        if time.monotonic() - start >= timeout_seconds:
            check_fresh_derived_data_batch.delay(
                group_id_start=derived.group_id + 1,
                group_id_end=group_id_end,
            )
            metrics.incr(
                "issues.derived.check_fresh_batch_rescheduled",
                sample_rate=1.0,
                tags={"reason": "batch_timeout"},
            )
            if activation_id:
                mark_spawned(_CHECK_FRESH_BATCH_TASK_KEY, activation_id)
            return


@instrumented_task(
    name="sentry.issues.derived.tasks.regenerate_stale_derived_data_batch",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=int(BATCH_PROCESSING_DEADLINE.total_seconds()),
)
def regenerate_stale_derived_data_batch(
    group_id_start: int,
    group_id_end: int,
    target_hash: str | None = None,  # None targets the NULL hash, not "unset"
    resume_generated_at: str | None = None,
    resume_pipeline_hash: str | None = None,
    rows_found_before: int = 0,
    range_overflowed: bool = False,
    **kwargs: object,
) -> None:
    """Rebuild GroupDerivedData rows in ``[group_id_start, group_id_end)`` whose ``pipeline_hash`` is ``target_hash``.

    A *target_hash* of None targets rows with no hash, i.e. ones explicitly
    invalidated. Rows that have raced to the current hash are filtered out
    naturally. Reschedules the remaining range on batch or per-group timeout.
    """
    logger.info(
        "regenerate_stale_derived_data_batch.started",
        extra={
            "target_hash": target_hash,
            "group_id_start": group_id_start,
            "group_id_end": group_id_end,
        },
    )
    from taskbroker_client.state import current_task

    from sentry.issues.derived.heal import regenerate_stale_derived_data_batch as regenerate
    from sentry.issues.derived.tasks_util import SpawnState

    spawn = SpawnState(current_task(), _REGENERATE_STALE_BATCH_TASK_KEY)
    if spawn.already_spawned():
        logger.info(
            "regenerate_stale_derived_data_batch.duplicate_skipped",
            extra={
                "target_hash": target_hash,
                "activation_id": spawn.activation_id,
            },
        )
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": spawn.task_key},
        )
        return

    start = time.monotonic()
    result = regenerate(
        target_hash=target_hash,
        group_id_start=group_id_start,
        group_id_end=group_id_end,
        timeout=BATCH_RETRIGGER_TIMEOUT,
        resume_generated_at=resume_generated_at,
        resume_pipeline_hash=resume_pipeline_hash,
        rows_found_before=rows_found_before,
        range_overflowed=range_overflowed,
    )

    if result.continuation is not None:
        assert result.continuation_reason is not None
        metrics.incr(
            "issues.derived.regenerate_stale_batch_rescheduled",
            sample_rate=1.0,
            tags={"reason": result.continuation_reason},
        )
        _enqueue_regeneration(result.continuation)
        spawn.mark_spawned()

    logger.info(
        "regenerate_stale_derived_data_batch.complete",
        extra={
            "target_hash": target_hash,
            "group_id_start": group_id_start,
            "group_id_end": group_id_end,
            "processed": {r.value: c for r, c in result.processed.items()},
            "total": result.total,
            "rescheduled": result.continuation is not None,
            "elapsed": time.monotonic() - start,
        },
    )
