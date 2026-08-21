from __future__ import annotations

import logging
import time
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from django.db.models import Exists, OuterRef, Q

from sentry.silo.base import SiloMode

if TYPE_CHECKING:
    from sentry.db.models.manager.base_query_set import BaseQuerySet
    from sentry.issues.derived.processing import GenerationId
    from sentry.issues.derived.promote import PromotionResult
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
# Hard cap on distinct stale pipeline hashes handled per heal invocation.
# In practice we expect a handful at most; truncating still makes progress.
_MAX_STALE_HASHES = 5
# Hard cap on stale group IDs loaded per heal invocation, across all
# stale hashes combined. The task runs every 15 minutes; overflow waits.
_MAX_STALE_GROUPS = 10_000


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


def _record_batch_metrics(
    processed: dict[PromotionResult, int],
    *,
    metric_name: str,
    tag_extra: dict[str, str] | None = None,
) -> None:
    for result, count in processed.items():
        tags = {"result": result.value}
        if tag_extra:
            tags.update(tag_extra)
        metrics.incr(metric_name, amount=count, sample_rate=1.0, tags=tags)


def _resume_generation_id(
    group_id: int,
    resume_generated_at: str | None,
    resume_pipeline_hash: str | None,
) -> GenerationId | None:
    """Reconstruct a ``GenerationId`` from resume kwargs, or ``None`` if either is missing.

    Tasks accept ``resume_generated_at`` / ``resume_pipeline_hash`` as separate
    scalars (rather than a single ``GenerationId``) because tasks serialize
    kwargs as JSON. This helper re-hydrates them at task entry.
    """
    from sentry.issues.derived.processing import GenerationId

    if resume_generated_at is None or resume_pipeline_hash is None:
        return None
    return GenerationId(
        group_id,
        datetime.fromisoformat(resume_generated_at).replace(tzinfo=timezone.utc),
        resume_pipeline_hash,
    )


@instrumented_task(
    name="sentry.issues.derived.tasks.process_group_log_task",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def process_group_log_task(group_id: int, incremental: bool = False, **kwargs: object) -> None:
    """Drain all pending action log entries for a single group into its derived data."""
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
    from taskbroker_client.state import current_task

    from sentry.issues.derived.processing import GroupLogTimeout
    from sentry.issues.derived.promote import PromotionFailed, build_and_promote_derived_data
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
    from taskbroker_client.state import current_task

    from sentry import options
    from sentry.issues.derived.processing import PIPELINE
    from sentry.models.group import Group
    from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned

    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_GENERATE_PROJECT_TASK_KEY, activation_id):
        logger.info(
            "generate_project_derived_data.duplicate_redelivery.skipped",
            extra={"project_id": project_id, "activation_id": activation_id},
        )
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _GENERATE_PROJECT_TASK_KEY},
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
        generate_project_derived_data.apply_async(
            kwargs={
                "project_id": project_id,
                "cursor_group_id": next_cursor_group_id,
                "stale_only": stale_only,
            },
            headers={"sentry-propagate-traces": False},
        )
        if activation_id:
            mark_spawned(_GENERATE_PROJECT_TASK_KEY, activation_id)

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
    from taskbroker_client.state import current_task

    from sentry.issues.derived.processing import PIPELINE
    from sentry.issues.derived.promote import build_and_promote_batch
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


def _discover_stale_pipeline_hashes(current_hash: str, limit: int) -> list[str]:
    """Return up to ``limit`` distinct non-null GroupDerivedData ``pipeline_hash`` values that aren't ``current_hash``.
    NULL is always stale, so we don't bother finding it here.
    """
    from sentry.issues.models.groupderiveddata import GroupDerivedData

    # A simple select distinct works here, but Postgres isn't (yet?) smart enough to
    # do it without O(stale rows) work. So instead, we just loop through the pipeline
    # hashes in the table, doing one very fast btree lookup each, and ignore the current
    # one. len(unique hashes) should always be single-digit in practice, so this should
    # always be fast. We could also do a recursive query to avoid some roundtrips; this is
    # just less exotic.

    results: list[str] = []
    cursor: str | None = ""
    while len(results) < limit:
        cursor = (
            GroupDerivedData.objects.filter(pipeline_hash__gt=cursor)
            .order_by("pipeline_hash")
            .values_list("pipeline_hash", flat=True)
            .first()
        )
        if cursor is None:
            break
        if cursor != current_hash:
            results.append(cursor)
    return results


def _stale_hash_filter(pipeline_hashes: Sequence[str]) -> Q:
    """Q filter matching GroupDerivedData rows whose ``pipeline_hash`` is NULL or in ``pipeline_hashes``."""
    stale = Q(pipeline_hash__isnull=True)
    if pipeline_hashes:
        stale |= Q(pipeline_hash__in=list(pipeline_hashes))
    return stale


@instrumented_task(
    name="sentry.issues.derived.tasks.heal_stale_derived_data",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def heal_stale_derived_data(**kwargs: object) -> None:
    """Rebuild a chunk of GroupDerivedData rows whose ``pipeline_hash`` is stale/NULL."""
    from sentry import options
    from sentry.issues.derived.processing import PIPELINE
    from sentry.issues.derived.tasks_util import _pick_random_fresh_group_ranges
    from sentry.issues.models.groupderiveddata import GroupDerivedData

    if not options.get("issues.derived.heal-enabled"):
        logger.info("heal_stale_derived_data.disabled")
        return

    batch_size = options.get("issues.derived.heal-batch-size")
    max_tasks = options.get("issues.derived.heal-max-tasks")
    current_hash = PIPELINE.pipeline_hash

    # We fetch known stale hashes and match on those for better index usage.
    # Querying for rows that aren't the fresh hash ends up being a full index scan,
    # whereas providing positive examples to match lets us do more efficient btree walking.
    stale_hashes = _discover_stale_pipeline_hashes(current_hash, _MAX_STALE_HASHES)

    group_ids = list(
        GroupDerivedData.objects.filter(_stale_hash_filter(stale_hashes))
        .order_by("group_id")
        .values_list("group_id", flat=True)[:_MAX_STALE_GROUPS]
    )
    if not group_ids:
        logger.info("heal_stale_derived_data.nothing_to_heal")
        check_ranges = _pick_random_fresh_group_ranges(
            current_hash,
            batch_size=batch_size,
            task_count=options.get("issues.derived.check-task-count"),
        )
        for start, end in check_ranges:
            check_fresh_derived_data_batch.delay(
                group_id_start=start,
                group_id_end=end,
            )

        logger.info(
            "heal_stale_derived_data.checks_scheduled",
            extra={
                "task_count": len(check_ranges),
                "pipeline_hash": current_hash,
            },
        )
        return

    ranges = _chunk_group_ids_into_ranges(group_ids, batch_size)[:max_tasks]

    for start, end in ranges:
        regenerate_stale_derived_data_batch.delay(
            stale_pipeline_hashes=stale_hashes,
            group_id_start=start,
            group_id_end=end,
        )

    logger.info(
        "heal_stale_derived_data.scheduled",
        extra={
            "stale_hashes": stale_hashes,
            "task_count": len(ranges),
            "group_count": len(group_ids),
            "pipeline_hash": current_hash,
        },
    )


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
    from taskbroker_client.state import current_task

    from sentry.issues.derived.check import CheckInvalidated, CheckTimeout, check_derived_data
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

    derived_rows = GroupDerivedData.objects.filter(
        pipeline_hash=PIPELINE.pipeline_hash,
        group_id__gte=group_id_start,
        group_id__lt=group_id_end,
    ).order_by("group_id")
    start = time.monotonic()
    timeout_seconds = BATCH_RETRIGGER_TIMEOUT.total_seconds()
    for derived in derived_rows.iterator():
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
    stale_pipeline_hashes: list[str],
    group_id_start: int,
    group_id_end: int,
    resume_generated_at: str | None = None,
    resume_pipeline_hash: str | None = None,
    **kwargs: object,
) -> None:
    """Rebuild GroupDerivedData rows in ``[group_id_start, group_id_end)`` whose ``pipeline_hash`` is NULL or in ``stale_pipeline_hashes``.

    Rows that have raced to the current hash are filtered out naturally.
    Reschedules the remaining range on batch or per-group timeout.
    """
    from taskbroker_client.state import current_task

    from sentry.issues.derived.promote import build_and_promote_batch
    from sentry.issues.models.groupderiveddata import GroupDerivedData
    from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned

    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_REGENERATE_STALE_BATCH_TASK_KEY, activation_id):
        logger.info(
            "regenerate_stale_derived_data_batch.duplicate_skipped",
            extra={
                "stale_pipeline_hashes": stale_pipeline_hashes,
                "activation_id": activation_id,
            },
        )
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _REGENERATE_STALE_BATCH_TASK_KEY},
        )
        return

    # Reconstruct generation_id for resuming the first group from cache.
    generation_id = _resume_generation_id(group_id_start, resume_generated_at, resume_pipeline_hash)

    start = time.monotonic()

    group_ids = list(
        GroupDerivedData.objects.filter(
            _stale_hash_filter(stale_pipeline_hashes),
            group_id__gte=group_id_start,
            group_id__lt=group_id_end,
        )
        .order_by("group_id")
        .values_list("group_id", flat=True)
    )

    result = build_and_promote_batch(
        group_ids,
        timeout=BATCH_RETRIGGER_TIMEOUT,
        initial_generation_id=generation_id,
        log_key="regenerate_stale_derived_data_batch",
    )

    rescheduled = False
    if result.timeout_reason is not None:
        rescheduled = True
        metrics.incr(
            "issues.derived.regenerate_stale_batch_rescheduled",
            sample_rate=1.0,
            tags={"reason": result.timeout_reason},
        )
        assert result.resume_from_group_id is not None
        gen_id = result.resume_generation_id
        regenerate_stale_derived_data_batch.delay(
            stale_pipeline_hashes=stale_pipeline_hashes,
            group_id_start=result.resume_from_group_id,
            group_id_end=group_id_end,
            resume_generated_at=gen_id.generated_at.isoformat() if gen_id else None,
            resume_pipeline_hash=gen_id.pipeline_hash if gen_id else None,
        )
        if activation_id:
            mark_spawned(_REGENERATE_STALE_BATCH_TASK_KEY, activation_id)

    _record_batch_metrics(
        result.processed,
        metric_name="issues.derived.regenerate_stale_groups_processed",
    )
    logger.info(
        "regenerate_stale_derived_data_batch.complete",
        extra={
            "stale_pipeline_hashes": stale_pipeline_hashes,
            "group_id_start": group_id_start,
            "group_id_end": group_id_end,
            "processed": {r.value: c for r, c in result.processed.items()},
            "total": len(group_ids),
            "rescheduled": rescheduled,
            "elapsed": time.monotonic() - start,
        },
    )
