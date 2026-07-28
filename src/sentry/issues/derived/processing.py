import enum
import logging
import time
from datetime import datetime, timedelta
from typing import NamedTuple

from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils import timezone

from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.framework import Pipeline
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.derived.tasks import process_group_log_task
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import EPOCH, GroupDerivedData
from sentry.models.group import Group
from sentry.utils import metrics
from sentry.workflow_engine.caches.mapping import CacheMapping

logger = logging.getLogger(__name__)

PIPELINE: Pipeline[GroupActionLogEntry] = Pipeline(AGGREGATORS)

DEFAULT_BATCH_SIZE = 1000
INLINE_BATCH_SIZE = 100

# Fields that constitute the derived state, written by promote_to_live.
# Derived by excluding identity, control, and auto-managed fields from the
# model — new columns are automatically included unless explicitly excluded.
_EXCLUDED_FIELDS = frozenset({"id", "group_id", "date_added", "date_updated"})
_STATE_FIELDS = tuple(
    f.attname for f in GroupDerivedData._meta.concrete_fields if f.attname not in _EXCLUDED_FIELDS
)


class GenerationId(NamedTuple):
    """Uniquely identifies a generation attempt for a group."""

    group_id: int
    generated_at: datetime  # when this generation started; reflects log state observed
    pipeline_hash: str


# Cache for in-progress generation state.
_generation_cache = CacheMapping[GenerationId, GroupDerivedData](
    lambda k: f"{k.group_id}:{k.generated_at.isoformat()}:{k.pipeline_hash}",
    namespace="gdd-generation",
    ttl_seconds=86400,
)


class ProcessingStrategy(enum.Enum):
    SYNC = "sync"  # process all pending actions now
    ASYNC = "async"  # schedule a task to process all pending actions
    INLINE = "inline"  # try to process all pending actions quickly; fall back to ASYNC


def _ensure_derived(group_id: int, pipeline_hash: str) -> GroupDerivedData:
    """Get or create the GroupDerivedData row for a group.

    Raises Group.DoesNotExist if the group has been deleted.
    """
    try:
        return GroupDerivedData.objects.get(group_id=group_id)
    except GroupDerivedData.DoesNotExist:
        pass

    try:
        derived, _created = GroupDerivedData.objects.get_or_create(
            group_id=group_id,
            defaults={
                "cursor_date": EPOCH,
                "cursor_id": 0,
                "data": {},
                "pipeline_hash": pipeline_hash,
            },
        )
    except IntegrityError:
        raise Group.DoesNotExist(f"Group {group_id} does not exist")
    return derived


def _entries_after_cursor(
    group_id: int, cursor_date: datetime, cursor_id: int, batch_size: int
) -> list[GroupActionLogEntry]:
    return list(
        GroupActionLogEntry.objects.filter(group_id=group_id)
        .extra(
            where=['ROW("date_added", "id") > ROW(%s, %s)'],
            params=[cursor_date, cursor_id],
        )
        .order_by("date_added", "id")[:batch_size]
    )


def _process_batch(
    p: Pipeline[GroupActionLogEntry],
    derived: GroupDerivedData,
    batch_size: int,
    *,
    persist: bool = True,
) -> bool:
    """
    Process up to `batch_size` entries for a group. Updates derived in place.
    Returns True if there are more entries to process.

    Concurrency: multiple callers may process the same group simultaneously.
    Safety relies on two properties:

    1. The action log is append-only and the pipeline is deterministic, so
       any caller processing the same entries produces the same result.
    2. The UPDATE uses a cursor guard that only succeeds if no
       other caller has already advanced the cursor past our batch. If it
       fails (updated == 0), a concurrent caller already wrote a superset
       of our work, so we refresh and check if more remains.

    This is an optimistic concurrency scheme — no locks are held, and the
    last-writer-wins semantics are safe because all writers compute the
    same deterministic result for overlapping entry ranges.

    When *persist* is False, only the in-memory object is updated — the
    caller is responsible for persisting the result (e.g. via
    ``promote_to_live``). Used for full generations that accumulate
    state in memory and write once at the end.
    """
    group_id = derived.group_id
    entries = _entries_after_cursor(group_id, derived.cursor_date, derived.cursor_id, batch_size)

    if not entries:
        return False

    result = p.run(entries, state=GroupDerivedDataStore.load(p, derived))

    last = entries[-1]
    last_date = last.date_added
    last_id = last.id
    state_update = GroupDerivedDataStore.build_update(p, result)

    if not persist:
        derived.cursor_date = last_date
        derived.cursor_id = last_id
        GroupDerivedDataStore.apply_to_instance(derived, state_update)
        return len(entries) == batch_size

    updated = GroupDerivedData.objects.filter(
        Q(id=derived.id, generated_at=derived.generated_at)
        & (Q(cursor_date__lt=last_date) | Q(cursor_date=last_date, cursor_id__lte=last_id))
        & Q(pipeline_hash=derived.pipeline_hash)
    ).update(cursor_date=last_date, cursor_id=last_id, **state_update)

    if updated:
        # Features updated in this batch (not total; a feature appears at most once per batch)
        for f in result.updated:
            metrics.incr(
                "issues.derived.feature_updated", sample_rate=1.0, tags={"feature": f.name}
            )
        derived.cursor_date = last_date
        derived.cursor_id = last_id
        GroupDerivedDataStore.apply_to_instance(derived, state_update)
        logger.info(
            "issues.derived.processed",
            extra={
                "group_id": group_id,
                "cursor_date": str(last_date),
                "cursor_id": last_id,
                "batch_size": len(entries),
            },
        )
        return len(entries) == batch_size
    else:
        try:
            derived.refresh_from_db()
        except GroupDerivedData.DoesNotExist:
            return False
        logger.info(
            "issues.derived.superseded",
            extra={
                "group_id": group_id,
                "our_cursor_id": last_id,
                "db_cursor_id": derived.cursor_id,
            },
        )
        # A concurrent caller advanced the cursor past us. Check whether
        # there are still entries beyond the refreshed cursor so we don't
        # silently stop processing.
        return bool(_entries_after_cursor(group_id, derived.cursor_date, derived.cursor_id, 1))


class GroupLogTimeout(Exception):
    """Raised when processing cannot finish within its time budget."""

    def __init__(self, group_id: int, generation_id: GenerationId | None = None) -> None:
        self.group_id = group_id
        self.generation_id = generation_id
        super().__init__(group_id)


def _drain_log(
    derived: GroupDerivedData,
    pipeline: Pipeline[GroupActionLogEntry],
    batch_size: int = DEFAULT_BATCH_SIZE,
    *,
    time_limit: timedelta,
    persist: bool = True,
) -> bool:
    """Process pending log entries into *derived*, batching as needed.

    Returns True if all entries were processed, False if the time limit was
    reached and more entries remain. The limit is checked between batches,
    so a single slow batch can exceed it.

    When *persist* is False, batches update only the in-memory object.
    """
    deadline = time.monotonic() + time_limit.total_seconds()
    while _process_batch(pipeline, derived, batch_size, persist=persist):
        if time.monotonic() >= deadline:
            return False
    return True


# ---------------------------------------------------------------------------
# Incremental processing (on event arrival)
# ---------------------------------------------------------------------------


def process_group_log(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    pipeline: Pipeline[GroupActionLogEntry] | None = None,
    timeout: timedelta | None = None,
) -> GroupDerivedData:
    """Fully drain all pending entries for a group's row.

    Raises Group.DoesNotExist if the group has been deleted.
    Raises GroupLogTimeout if *timeout* elapses before all
    entries are processed.
    """
    p = pipeline or PIPELINE

    with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
        derived = _ensure_derived(group_id, p.pipeline_hash)

    if timeout is not None:
        drained = _drain_log(derived, p, batch_size, time_limit=timeout)
        if not drained:
            raise GroupLogTimeout(group_id)
    else:
        # No timeout — drain to completion.
        while _process_batch(p, derived, batch_size):
            pass

    return derived


def trigger_group_log_processing(group_id: int, *, strategy: ProcessingStrategy) -> None:
    """Trigger derived data processing for a group.

    Silently returns if the group has been deleted or no row exists.

    Strategy controls how processing is dispatched:
      SYNC   — process all pending actions now
      ASYNC  — schedule a task to process all pending actions
      INLINE — try to process all pending actions quickly; fall back to ASYNC
    """
    if strategy is ProcessingStrategy.ASYNC:
        process_group_log_task.delay(group_id)
        return

    if strategy is ProcessingStrategy.SYNC:
        try:
            process_group_log(group_id)
        except ObjectDoesNotExist:
            pass
        return

    assert strategy is ProcessingStrategy.INLINE

    pipeline = PIPELINE

    with metrics.timer("issues.derived.inline_processing"):
        try:
            with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
                derived = _ensure_derived(group_id, pipeline.pipeline_hash)
        except ObjectDoesNotExist:
            return

        has_more = _process_batch(pipeline, derived, INLINE_BATCH_SIZE)
    if has_more:
        # Derived data will be stale for any code running between now and
        # when the task completes.
        metrics.incr("issues.derived.inline_fallback_to_async")
        process_group_log_task.delay(group_id)


# ---------------------------------------------------------------------------
# Generation lifecycle: build in memory, upsert, cache partial progress
# ---------------------------------------------------------------------------


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
        drained = _drain_log(derived, PIPELINE, batch_size, time_limit=remaining, persist=False)
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


# ---------------------------------------------------------------------------
# Invalidation
# ---------------------------------------------------------------------------


def invalidate_group_derived_data(
    group_id: int,
    cursor: tuple[datetime, int] | None = None,
) -> None:
    """Delete derived state so it is rebuilt from scratch on the next pass,
    then kicks off an async task to regenerate the derived data.

    If *cursor* is ``(date_added, id)`` of the earliest affected entry, the
    row is only deleted when its cursor is at or past that point; otherwise
    the mutation is still ahead of processing and no invalidation is needed.
    Without a cursor the invalidation is unconditional.
    """
    if cursor is None:
        GroupDerivedData.objects.filter(group_id=group_id).delete()
        process_group_log_task.delay(group_id)
        return

    # Only invalidate if the row has already processed past the affected point.
    cursor_date, cursor_id = cursor
    deleted, _ = GroupDerivedData.objects.filter(
        Q(group_id=group_id)
        & (Q(cursor_date__gt=cursor_date) | Q(cursor_date=cursor_date, cursor_id__gte=cursor_id)),
    ).delete()
    if deleted:
        logger.info(
            "issues.derived.invalidated",
            extra={
                "group_id": group_id,
                "cursor_date": str(cursor_date),
                "cursor_id": cursor_id,
            },
        )
        process_group_log_task.delay(group_id)
