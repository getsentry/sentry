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


class PromotionFailed(Exception):
    """Raised when build_and_promote_derived_data exhausts its retry budget."""

    def __init__(self, group_id: int, result: PromotionResult, attempts: int) -> None:
        self.group_id = group_id
        self.result = result
        self.attempts = attempts
        super().__init__(f"group {group_id}: {result.value} after {attempts} attempts")


def promote_to_live(candidate: GroupDerivedData) -> PromotionResult:
    """Upsert the candidate's state into the row for its group.

    The UPDATE guard requires that ``candidate.generated_at`` is >= the
    row's (newer generation wins) and the cursor is at or ahead.  On
    success, all state fields (including ``generated_at``) are stamped.

    Returns SUPERSEDED if the row has a newer ``generated_at``.
    Returns CURSOR_BEHIND if the cursor guard failed.

    The candidate object itself is not persisted — it may be an unsaved
    in-memory instance used only to carry the computed state.
    """
    generated_at = candidate.generated_at
    values = {f: getattr(candidate, f) for f in _STATE_FIELDS}

    cursor_ahead = Q(cursor_date__lt=candidate.cursor_date) | Q(
        cursor_date=candidate.cursor_date, cursor_id__lte=candidate.cursor_id
    )
    updated = GroupDerivedData.objects.filter(
        cursor_ahead,
        group_id=candidate.group_id,
        generated_at__lte=generated_at,
    ).update(**values)

    if updated:
        return PromotionResult.PROMOTED

    # Check why we failed: row missing or newer generation?
    row = (
        GroupDerivedData.objects.filter(group_id=candidate.group_id)
        .values_list("id", "generated_at")
        .first()
    )

    if row is None:
        # Row doesn't exist — try to create it.
        try:
            with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
                GroupDerivedData.objects.create(
                    group_id=candidate.group_id,
                    **values,
                )
        except IntegrityError:
            # A concurrent writer created the row first. This could be
            # SUPERSEDED (if their generated_at is newer) but we'd need
            # another query to distinguish. CURSOR_BEHIND triggers a
            # retry which will resolve it on the UPDATE path.
            return PromotionResult.CURSOR_BEHIND
        return PromotionResult.PROMOTED

    _row_id, current_generated_at = row
    if current_generated_at > generated_at:
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

        result = promote_to_live(derived)
        metrics.incr("issues.derived.promote_to_live", tags={"result": result.value})
        if result is PromotionResult.PROMOTED:
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

        if result is PromotionResult.SUPERSEDED:
            # A newer generation already won — not an error.
            _generation_cache.delete(current_gen_id)
            return

        # CURSOR_BEHIND: the live row's cursor is ahead of ours.
        # If new entries exist past our cursor, the next drain will pick
        # them up. If not, the log was modified (e.g. merge deleted
        # entries) and our replay is incomplete — give up.
        if not _entries_after_cursor(group_id, derived.cursor_date, derived.cursor_id, 1):
            break

    _generation_cache.delete(current_gen_id)
    raise PromotionFailed(group_id, result, attempt + 1)


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
            logger.exception(f"{log_key}.promotion_failed")
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
