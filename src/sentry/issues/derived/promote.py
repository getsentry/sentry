"""Promote a fully-computed GroupDerivedData generation into the live row.

Strategy: bring our candidate up to date against the log, attempt an
atomic CAS against the current live row, and if the CAS fails, retry
unless post-hoc classification shows a retry can't help. After
``MAX_PROMOTION_ATTEMPTS`` failed attempts we give up with
``PromotionFailed``.

The UPDATE is the canonical decision point; the follow-up reads only
decide whether another attempt is worthwhile.
"""

from __future__ import annotations

import enum
import logging
import time
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Literal, NamedTuple

from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils import timezone

from sentry.db.postgres.transactions import enforce_constraints
from sentry.issues.derived.processing import (
    DEFAULT_BATCH_SIZE,
    PIPELINE,
    DerivedMetrics,
    GenerationId,
    GroupLogTimeout,
    ProcessingStrategy,
    _drain_log,
    _entries_after_cursor,
)
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import EPOCH, GroupDerivedData
from sentry.models.group import Group
from sentry.utils import metrics
from sentry.workflow_engine.caches.mapping import CacheMapping

logger = logging.getLogger(__name__)

# Fields that constitute the derived state, written by promote_to_live.
# Derived by excluding identity, control, and auto-managed fields from the
# model — new columns are automatically included unless explicitly excluded.
_EXCLUDED_FIELDS = frozenset({"id", "group_id", "date_added", "date_updated"})
_STATE_FIELDS = tuple(
    f.attname for f in GroupDerivedData._meta.concrete_fields if f.attname not in _EXCLUDED_FIELDS
)


# Cache for in-progress generation state.
_generation_cache = CacheMapping[GenerationId, GroupDerivedData](
    lambda k: f"{k.group_id}:{k.generated_at.isoformat()}:{k.pipeline_hash}",
    namespace="gdd-generation",
    ttl_seconds=86400,
)


class PromotionResult(enum.Enum):
    PROMOTED = "promoted"
    SUPERSEDED = "superseded"  # a newer generation already promoted
    CURSOR_BEHIND = "cursor_behind"  # same generation, but cursor is more advanced
    # Lost a create race to a same/older-generation writer whose cursor
    # is not necessarily ahead. Returned instead of looping internally
    # to keep promote_to_live a single CAS attempt; the caller owns the
    # retry budget.
    RACE_LOST = "race_lost"
    GROUP_MISSING = "group_missing"  # the group was deleted; nothing to promote onto


class PromotionFailed(Exception):
    """Raised when build_and_promote_derived_data exhausts its retry budget."""

    def __init__(self, group_id: int, result: PromotionResult, attempts: int) -> None:
        self.group_id = group_id
        self.result = result
        self.attempts = attempts
        super().__init__(f"group {group_id}: {result.value} after {attempts} attempts")


def _read_live_generated_at(group_id: int) -> datetime | None:
    """Return the live row's ``generated_at``, or None if the row is absent."""
    return (
        GroupDerivedData.objects.filter(group_id=group_id)
        .values_list("generated_at", flat=True)
        .get_or_none()
    )


def _classify_failed_create(group_id: int, generated_at: datetime) -> PromotionResult:
    """Explain an IntegrityError from the promote INSERT.

    The model constrains ``group`` to be unique and to reference a live
    Group, so the error is either a concurrent writer winning the create
    race or the group having been deleted underneath us.
    """
    live_generated_at = _read_live_generated_at(group_id)
    if live_generated_at is None:
        # No visible winner. If the group is gone, that's the FK
        # violation. Otherwise we lost to some other race (e.g. a
        # concurrent GDD delete between our INSERT and this read);
        # retry rather than guess at the exact sequence.
        if not Group.objects.filter(id=group_id).exists():
            return PromotionResult.GROUP_MISSING
        return PromotionResult.RACE_LOST

    if live_generated_at > generated_at:
        return PromotionResult.SUPERSEDED
    # The winner is same-or-older generation, so its cursor position
    # tells us nothing about the log tail. Not CURSOR_BEHIND: that name
    # implies the winner is genuinely ahead, and the caller uses it to
    # decide to give up.
    return PromotionResult.RACE_LOST


def promote_to_live(
    candidate: GroupDerivedData, *, known_invalid_log_id: int | None = None
) -> PromotionResult:
    """Upsert the candidate's state into the row for its group.

    The UPDATE guard requires that ``candidate.generated_at`` is >= the
    row's (newer generation wins) and the cursor is at or ahead. If the
    live cursor points at ``known_invalid_log_id`` — a log entry the caller
    has confirmed no longer belongs to this group — the cursor guard is
    bypassed, since that cursor doesn't represent a real position in the
    group's log. On success, all state fields (including ``generated_at``)
    are stamped.

    Returns SUPERSEDED if the row has a newer ``generated_at``.
    Returns CURSOR_BEHIND if the cursor guard failed against a same or
    older generation whose cursor is genuinely ahead.
    Returns RACE_LOST if we lost a create race to a same-or-older
    generation whose cursor may not be ahead — the caller should retry
    unconditionally rather than treating "no new log entries" as fatal.
    Returns GROUP_MISSING if the group has been deleted.

    The candidate object itself is not persisted — it may be an unsaved
    in-memory instance used only to carry the computed state.
    """
    generated_at = candidate.generated_at
    values = {f: getattr(candidate, f) for f in _STATE_FIELDS}

    cursor_ahead = Q(cursor_date__lt=candidate.cursor_date) | Q(
        cursor_date=candidate.cursor_date, cursor_id__lte=candidate.cursor_id
    )
    if known_invalid_log_id is not None:
        cursor_ahead |= Q(cursor_id=known_invalid_log_id)
    updated = GroupDerivedData.objects.filter(
        cursor_ahead,
        group_id=candidate.group_id,
        generated_at__lte=generated_at,
    ).update(**values)

    if updated:
        return PromotionResult.PROMOTED

    # Check why we failed: row missing or newer generation?
    live_generated_at = _read_live_generated_at(candidate.group_id)

    if live_generated_at is None:
        # Row doesn't exist — try to create it. enforce_constraints so a
        # violation surfaces here instead of floating up to an
        # enclosing transaction's commit.
        try:
            with enforce_constraints(
                transaction.atomic(using=router.db_for_write(GroupDerivedData))
            ):
                GroupDerivedData.objects.create(
                    group_id=candidate.group_id,
                    **values,
                )
        except IntegrityError:
            return _classify_failed_create(candidate.group_id, generated_at)
        return PromotionResult.PROMOTED

    if live_generated_at > generated_at:
        return PromotionResult.SUPERSEDED
    return PromotionResult.CURSOR_BEHIND


MAX_PROMOTION_ATTEMPTS = 5


def build_and_promote_derived_data(
    group_id: int,
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
    generation_id: GenerationId | None = None,
    time_limit: timedelta,
) -> None:
    """Build derived data from scratch and upsert into the row.

    Drains the full action log into an in-memory object, then upserts
    via ``promote_to_live`` with a CAS on ``generated_at``.  The
    generation's ``generated_at`` is captured at start — it reflects the
    log state observed, not when the generation finished.

    When *generation_id* is provided, previously cached partial progress
    is loaded and resumed.

    Raises GroupLogTimeout (with ``generation_id`` set) if the time-limited
    drain could not finish, so the caller can re-enqueue.
    Raises PromotionFailed if promotion cannot succeed after retries.
    Raises Group.DoesNotExist if the group has been deleted.
    """
    pipeline_hash = PIPELINE.pipeline_hash
    generated_at: datetime

    # Try to resume from cache.
    derived: GroupDerivedData | None = None
    if generation_id is not None:
        derived = _generation_cache.get(generation_id)
        generated_at = generation_id.generated_at
        if derived is None:
            logger.info(
                "issues.derived.build_and_promote.cache_miss",
                extra={"group_id": group_id, "generation_id": generation_id},
            )

    if derived is None:
        if not Group.objects.filter(id=group_id).exists():
            raise Group.DoesNotExist(f"Group {group_id} does not exist")
        generated_at = timezone.now()
        derived = GroupDerivedData(
            group_id=group_id,
            generated_at=generated_at,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=pipeline_hash,
        )

    current_gen_id = GenerationId(group_id, generated_at, pipeline_hash)
    deadline = time.monotonic() + time_limit.total_seconds()

    result = PromotionResult.CURSOR_BEHIND
    known_invalid_log_id: int | None = None
    for attempt in range(MAX_PROMOTION_ATTEMPTS):
        remaining = timedelta(seconds=max(0, deadline - time.monotonic()))
        drained = _drain_log(
            derived,
            PIPELINE,
            batch_size,
            time_limit=remaining,
            persist=False,
            derived_metrics=DerivedMetrics(mode=ProcessingStrategy.ASYNC, incremental=False),
        )
        if not drained:
            _generation_cache.set(current_gen_id, derived)
            raise GroupLogTimeout(group_id, generation_id=current_gen_id)

        result = promote_to_live(derived, known_invalid_log_id=known_invalid_log_id)
        metrics.incr("issues.derived.promote_to_live", tags={"result": result.value})
        match result:
            case PromotionResult.PROMOTED:
                logger.info(
                    "issues.derived.promoted",
                    extra={
                        "group_id": group_id,
                        "cursor_date": str(derived.cursor_date),
                        "cursor_id": derived.cursor_id,
                        "attempts": attempt + 1,
                    },
                )
                _generation_cache.delete(current_gen_id)
                return
            case PromotionResult.SUPERSEDED:
                # A newer generation already won — not an error.
                _generation_cache.delete(current_gen_id)
                return
            case PromotionResult.GROUP_MISSING:
                _generation_cache.delete(current_gen_id)
                raise Group.DoesNotExist(f"Group {group_id} does not exist")
            case PromotionResult.RACE_LOST:
                # Didn't fail, but didn't succeed due to a race.
                # Assuming there's not ongoing messy contention, the next attempt
                # should succeed or fail cleanly, so we retry.
                continue
            case PromotionResult.CURSOR_BEHIND:
                # The live row's cursor is ahead of ours. If new entries
                # exist past our cursor, the next drain will pick them up.
                if _entries_after_cursor(group_id, derived.cursor_date, derived.cursor_id, 1):
                    continue
                # If not, the log may have been modified (e.g. merge moved
                # the live cursor's entry to another group). Retry while
                # bypassing that specific log ID; a concurrent move of the
                # live cursor to any other position remains guarded.
                known_invalid_log_id = _detect_orphaned_log_id(group_id, derived)
                if known_invalid_log_id is not None:
                    continue
                break

    _generation_cache.delete(current_gen_id)
    raise PromotionFailed(group_id, result, attempt + 1)


def _detect_orphaned_log_id(group_id: int, derived: GroupDerivedData) -> int | None:
    """Return the live cursor's log ID if it no longer belongs to this group.

    Logs as a side effect. Called on the CURSOR_BEHIND path so the caller can
    retry promotion while bypassing that specific log ID.
    """
    live_cursor = (
        GroupDerivedData.objects.filter(group_id=group_id)
        .values_list("cursor_date", "cursor_id")
        .get_or_none()
    )
    if live_cursor is None:
        return None
    live_cursor_date, live_cursor_id = live_cursor
    if live_cursor_id == 0:
        # 0 is the "no actions yet" state; unexpected in this context, but doesn't suggest an
        # orphaned cursor.
        return None
    if GroupActionLogEntry.objects.filter(group_id=group_id, id=live_cursor_id).exists():
        return None
    logger.info(
        "issues.derived.promote.live_cursor_orphaned",
        extra={
            "group_id": group_id,
            "live_cursor_date": str(live_cursor_date),
            "live_cursor_id": live_cursor_id,
            "candidate_cursor_date": str(derived.cursor_date),
            "candidate_cursor_id": derived.cursor_id,
        },
    )
    return live_cursor_id


class BatchRunResult(NamedTuple):
    """Outcome of running build-and-promote across a batch of groups."""

    # Counts keyed by the terminal ``PromotionResult`` of each group.
    processed: dict[PromotionResult, int]
    # If the batch stopped early due to a timeout, the ID to resume from.
    resume_from_group_id: int | None
    # If the batch stopped early on a per-group timeout, the generation
    # to pass through to the next run so it can resume from cached progress.
    resume_generation_id: GenerationId | None
    timeout_reason: Literal["group_timeout", "batch_timeout"] | None


def build_and_promote_batch(
    group_ids: Sequence[int],
    *,
    timeout: timedelta,
    initial_generation_id: GenerationId | None = None,
    log_key: str,
    project_id: int | None = None,
) -> BatchRunResult:
    """Run build-and-promote for each group with a wall-clock ``timeout``.

    Stops early on batch or per-group timeout; callers self-reschedule
    using the returned resume hints. ``initial_generation_id`` is applied
    only to the group it identifies (``initial_generation_id.group_id``)
    so a resumed batch picks up cached progress for exactly that group.
    ``project_id`` is only used in log records.
    """
    timeout_seconds = timeout.total_seconds()
    start = time.monotonic()

    processed: dict[PromotionResult, int] = {}
    resume_group_id = initial_generation_id.group_id if initial_generation_id is not None else None

    for group_id in group_ids:
        remaining = timedelta(seconds=max(0, timeout_seconds - (time.monotonic() - start)))
        try:
            build_and_promote_derived_data(
                group_id,
                generation_id=(initial_generation_id if group_id == resume_group_id else None),
                time_limit=remaining,
            )
            processed[PromotionResult.PROMOTED] = processed.get(PromotionResult.PROMOTED, 0) + 1
        except Group.DoesNotExist:
            logger.info(
                f"{log_key}.group_not_found",
                extra={"group_id": group_id, "project_id": project_id},
            )
        except PromotionFailed as e:
            processed[e.result] = processed.get(e.result, 0) + 1
            logger.exception(
                f"{log_key}.promotion_failed",
                extra={"group_id": e.group_id},
            )
        except GroupLogTimeout as e:
            return BatchRunResult(
                processed=processed,
                resume_from_group_id=group_id,
                resume_generation_id=e.generation_id,
                timeout_reason="group_timeout",
            )

        if time.monotonic() - start >= timeout_seconds:
            return BatchRunResult(
                processed=processed,
                resume_from_group_id=group_id + 1,
                resume_generation_id=None,
                timeout_reason="batch_timeout",
            )

    return BatchRunResult(
        processed=processed,
        resume_from_group_id=None,
        resume_generation_id=None,
        timeout_reason=None,
    )
