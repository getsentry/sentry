from __future__ import annotations

import logging
import time
from bisect import bisect_left
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from django.db import router
from django.db.utils import OperationalError

from sentry import options
from sentry.issues.derived.heal_state import HealSchedulerState, load_state, save_state
from sentry.issues.derived.processing import PIPELINE
from sentry.issues.derived.promote import PromotionResult, build_and_promote_batch
from sentry.issues.derived.tasks_util import (
    _record_batch_metrics,
    _resume_generation_id,
)
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.utils import metrics
from sentry.utils.db import statement_timeout

logger = logging.getLogger(__name__)

_MAX_STALE_HASHES = 5
_STALE_HASH_DISCOVERY_TIMEOUT = timedelta(seconds=15)


@dataclass(frozen=True)
class RegenerationRequest:
    target_hash: str | None
    group_id_start: int
    group_id_end: int
    resume_generated_at: str | None = None
    resume_pipeline_hash: str | None = None
    rows_found_before: int = 0
    range_overflowed: bool = False


@dataclass(frozen=True)
class RegenerationResult:
    processed: Mapping[PromotionResult, int]
    total: int
    continuation: RegenerationRequest | None = None
    continuation_reason: str | None = None


def _discover_stale_pipeline_hashes(current_hash: str, limit: int) -> list[str]:
    """Return up to ``limit`` distinct non-null GroupDerivedData ``pipeline_hash`` values that aren't ``current_hash``.
    NULL is always stale, so we don't bother finding it here.
    """
    # A simple select distinct works here, but Postgres isn't (yet?) smart enough to
    # do it without O(stale rows) work. So instead, we just loop through the pipeline
    # hashes in the table, doing one very fast btree lookup each, and ignore the current
    # one. len(unique hashes) should always be single-digit in practice, so this should
    # always be fast. We could also do a recursive query to avoid some roundtrips; this is
    # just less exotic.
    results: list[str] = []
    cursor: str | None = ""
    using = router.db_for_read(GroupDerivedData)
    with statement_timeout(using, _STALE_HASH_DISCOVERY_TIMEOUT):
        while len(results) < limit:
            cursor = (
                GroupDerivedData.objects.using(using)
                .filter(pipeline_hash__gt=cursor)
                .order_by("pipeline_hash")
                .values_list("pipeline_hash", flat=True)
                .first()
            )
            if cursor is None:
                break
            if cursor != current_hash:
                results.append(cursor)
    return results


def heal_stale_derived_data(
    *,
    enqueue_regeneration: Callable[[RegenerationRequest], None],
    enqueue_check: Callable[[int, int], None],
) -> None:
    """Rebuild a chunk of GroupDerivedData rows whose ``pipeline_hash`` is stale/NULL."""
    started_at = time.monotonic()
    logger.info("heal_stale_derived_data.started")
    from sentry.issues.derived.tasks_util import (
        _pick_random_fresh_group_ranges,
        group_id_ranges_for_hash,
    )

    if not options.get("issues.derived.heal-enabled"):
        logger.info("heal_stale_derived_data.disabled")
        return

    batch_size = options.get("issues.derived.heal-batch-size")
    max_tasks = options.get("issues.derived.heal-max-tasks")
    current_hash = PIPELINE.pipeline_hash

    if batch_size <= 0 or max_tasks <= 0:
        logger.error(
            "heal_stale_derived_data.invalid_batch_configuration",
            extra={"batch_size": batch_size, "max_tasks": max_tasks},
        )
        return

    logger.info(
        "heal_stale_derived_data.configuration_loaded",
        extra={
            "batch_size": batch_size,
            "max_tasks": max_tasks,
            "pipeline_hash": current_hash,
        },
    )

    state = load_state()
    if state is None:
        state = HealSchedulerState()
        logger.info("heal_stale_derived_data.state_regenerated")
    else:
        logger.info("heal_stale_derived_data.state_loaded")

    hash_state_changed = False
    if state.head_hash != current_hash:
        if state.head_hash is not None:
            state.stale.setdefault(state.head_hash, 0)
        state.head_hash = current_hash
        hash_state_changed = True
    # A rollback can make a previously discovered stale hash current again.
    if state.stale.pop(current_hash, None) is not None:
        hash_state_changed = True

    # We fetch known stale hashes and match on those for better index usage.
    # Querying for rows that aren't the fresh hash ends up being a full index scan,
    # whereas providing positive examples to match lets us do more efficient btree walking.
    if not state.stale:
        discovery_started_at = time.monotonic()
        logger.info("heal_stale_derived_data.stale_hash_discovery_started")
        metrics.incr(
            "issues.derived.heal_stale_hash_discovery",
            sample_rate=1.0,
            tags={"reason": "no_state" if state.discovered_at is None else "stale_empty"},
        )
        try:
            with metrics.timer("issues.derived.heal_stale_hash_discovery_duration"):
                stale_hashes = _discover_stale_pipeline_hashes(current_hash, _MAX_STALE_HASHES)
        except OperationalError:
            logger.exception("heal_stale_derived_data.stale_hash_discovery_failed")
            metrics.incr("issues.derived.heal_stale_hash_discovery_failed", sample_rate=1.0)
            stale_hashes = []
        else:
            # Keep a fixed epoch despite CacheMapping's sliding eviction TTL.
            state.discovered_at = state.discovered_at or datetime.now(timezone.utc)
            state.stale.update(dict.fromkeys(stale_hashes, 0))
            hash_state_changed = True
            logger.info(
                "heal_stale_derived_data.stale_hash_discovery_complete",
                extra={
                    "stale_hashes": stale_hashes,
                    "elapsed": time.monotonic() - discovery_started_at,
                },
            )
    else:
        stale_hashes = list(state.stale)
        logger.info(
            "heal_stale_derived_data.stale_hash_discovery_skipped",
            extra={"stale_hash_count": len(state.stale)},
        )

    # Checkpoint hashes before potentially expensive range selection.
    if hash_state_changed:
        save_state(state)

    remaining = max_tasks
    scheduled_per_hash: dict[str, int] = {}
    # NULL is stateless because soft invalidation can create rows below any mark.
    for stale_hash in [None, *stale_hashes]:
        if remaining <= 0:
            break
        hash_kind = "null" if stale_hash is None else "stale"
        lower_bound = 0 if stale_hash is None else state.stale[stale_hash]
        logger.info(
            "heal_stale_derived_data.range_selection_started",
            extra={
                "hash_kind": hash_kind,
                "remaining_budget": remaining,
                "group_id_lower_bound": lower_bound,
            },
        )
        range_selection_started_at = time.monotonic()
        try:
            range_result = group_id_ranges_for_hash(
                stale_hash,
                range_size=batch_size,
                max_ranges=remaining,
                group_id_lower_bound=lower_bound,
            )
        except OperationalError:
            logger.exception(
                "heal_stale_derived_data.range_selection_failed",
                extra={
                    "hash_kind": hash_kind,
                    "elapsed": time.monotonic() - range_selection_started_at,
                    "pipeline_hash": stale_hash,
                    "group_id_lower_bound": lower_bound,
                },
            )
            metrics.incr(
                "issues.derived.heal_range_selection_failed",
                sample_rate=1.0,
                tags={"hash_kind": hash_kind},
            )
            continue
        ranges = range_result.ranges
        logger.info(
            "heal_stale_derived_data.range_selection_complete",
            extra={
                "hash_kind": hash_kind,
                "range_count": len(ranges),
                "remaining_budget": remaining,
                "elapsed": time.monotonic() - range_selection_started_at,
            },
        )
        if stale_hash is not None and range_result.drained:
            del state.stale[stale_hash]
            logger.info(
                "heal_stale_derived_data.stale_hash_retired",
                extra={"pipeline_hash": stale_hash, "group_id_mark": lower_bound},
            )
            save_state(state)
            continue
        if not ranges:
            continue
        logger.info(
            "heal_stale_derived_data.batch_dispatch_started",
            extra={"hash_kind": hash_kind, "task_count": len(ranges)},
        )
        for start, end in ranges:
            enqueue_regeneration(
                RegenerationRequest(
                    target_hash=stale_hash,
                    group_id_start=start,
                    group_id_end=end,
                )
            )
        remaining -= len(ranges)
        scheduled_per_hash["null" if stale_hash is None else stale_hash] = len(ranges)
        if stale_hash is not None:
            old_mark = state.stale[stale_hash]
            new_mark = ranges[-1][1]
            # Marks are optimistic. Dropped tasks and old workers can leave rows
            # below them because pipeline_hash is promoted state. The fixed state
            # age is the correctness backstop that forces a from-zero sweep.
            state.stale[stale_hash] = new_mark
            save_state(state)
            logger.info(
                "heal_stale_derived_data.stale_hash_mark_advanced",
                extra={
                    "pipeline_hash": stale_hash,
                    "old_group_id_mark": old_mark,
                    "new_group_id_mark": new_mark,
                },
            )
        logger.info(
            "heal_stale_derived_data.batch_dispatch_complete",
            extra={
                "hash_kind": hash_kind,
                "task_count": len(ranges),
                "remaining_budget": remaining,
            },
        )
        metrics.incr(
            "issues.derived.heal_ranges_scheduled",
            amount=len(ranges),
            sample_rate=1.0,
            tags={"hash_kind": hash_kind},
        )

    task_count = max_tasks - remaining
    if task_count == 0:
        logger.info("heal_stale_derived_data.nothing_to_heal")
    else:
        logger.info(
            "heal_stale_derived_data.scheduled",
            extra={
                "stale_hashes": stale_hashes,
                "task_count": task_count,
                "tasks_per_hash": scheduled_per_hash,
                "batch_size": batch_size,
                "pipeline_hash": current_hash,
            },
        )

    # Checks share the heal fan-out budget. Schedule them whenever leftover
    # capacity remains, not only when there is nothing stale to regenerate.
    check_budget = min(remaining, options.get("issues.derived.check-task-count"))
    if check_budget <= 0:
        logger.info(
            "heal_stale_derived_data.complete",
            extra={
                "heal_task_count": task_count,
                "check_task_count": 0,
                "elapsed": time.monotonic() - started_at,
            },
        )
        return

    logger.info(
        "heal_stale_derived_data.check_range_selection_started",
        extra={"check_budget": check_budget},
    )
    check_ranges = _pick_random_fresh_group_ranges(
        current_hash,
        batch_size=batch_size,
        task_count=check_budget,
    )
    logger.info(
        "heal_stale_derived_data.check_range_selection_complete",
        extra={"check_budget": check_budget, "range_count": len(check_ranges)},
    )
    logger.info(
        "heal_stale_derived_data.check_dispatch_started",
        extra={"task_count": len(check_ranges)},
    )
    for start, end in check_ranges:
        enqueue_check(start, end)

    logger.info(
        "heal_stale_derived_data.checks_scheduled",
        extra={
            "task_count": len(check_ranges),
            "pipeline_hash": current_hash,
            "heal_task_count": task_count,
            "remaining_budget": remaining,
        },
    )
    logger.info(
        "heal_stale_derived_data.complete",
        extra={
            "heal_task_count": task_count,
            "check_task_count": len(check_ranges),
            "elapsed": time.monotonic() - started_at,
        },
    )


def regenerate_stale_derived_data_batch(
    *,
    group_id_start: int,
    group_id_end: int,
    target_hash: str | None,
    timeout: timedelta,
    resume_generated_at: str | None = None,
    resume_pipeline_hash: str | None = None,
    rows_found_before: int = 0,
    range_overflowed: bool = False,
) -> RegenerationResult:
    """Rebuild rows in a range matching exactly ``target_hash``."""
    generation_id = _resume_generation_id(group_id_start, resume_generated_at, resume_pipeline_hash)
    batch_size = max(1, options.get("issues.derived.heal-batch-size"))
    group_ids = list(
        GroupDerivedData.objects.filter(
            pipeline_hash=target_hash,  # a None target renders as IS NULL
            group_id__gte=group_id_start,
            group_id__lt=group_id_end,
        )
        .order_by("group_id")
        .values_list("group_id", flat=True)[: batch_size + 1]
    )
    range_overflow = len(group_ids) > batch_size
    if range_overflow:
        group_ids = group_ids[:batch_size]

    result = build_and_promote_batch(
        group_ids,
        timeout=timeout,
        initial_generation_id=generation_id,
        log_key="regenerate_stale_derived_data_batch",
    )

    continuation: RegenerationRequest | None = None
    continuation_reason: str | None = None
    if result.timeout_reason is not None:
        assert result.resume_from_group_id is not None
        gen_id = result.resume_generation_id
        rows_consumed = bisect_left(group_ids, result.resume_from_group_id)
        continuation = RegenerationRequest(
            target_hash=target_hash,
            group_id_start=result.resume_from_group_id,
            group_id_end=group_id_end,
            resume_generated_at=gen_id.generated_at.isoformat() if gen_id else None,
            resume_pipeline_hash=gen_id.pipeline_hash if gen_id else None,
            rows_found_before=rows_found_before + rows_consumed,
            range_overflowed=range_overflowed or range_overflow,
        )
        continuation_reason = result.timeout_reason
    elif range_overflow:
        continuation = RegenerationRequest(
            target_hash=target_hash,
            group_id_start=group_ids[-1] + 1,
            group_id_end=group_id_end,
            rows_found_before=rows_found_before + len(group_ids),
            range_overflowed=True,
        )
        continuation_reason = "range_overflow"
    else:
        # Record one density observation for the scheduler's original range, not
        # one capped observation for every self-chain invocation.
        metrics.distribution(
            "issues.derived.heal_range_rows_found",
            rows_found_before + len(group_ids),
            sample_rate=1.0,
            tags={
                "hash_kind": "null" if target_hash is None else "stale",
                "range_overflowed": str(range_overflowed).lower(),
            },
        )

    _record_batch_metrics(
        result.processed,
        metric_name="issues.derived.regenerate_stale_groups_processed",
    )
    return RegenerationResult(
        processed=result.processed,
        total=len(group_ids),
        continuation=continuation,
        continuation_reason=continuation_reason,
    )
