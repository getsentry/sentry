import enum
import logging
import time
from datetime import datetime, timedelta
from typing import NamedTuple

from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, router, transaction
from django.db.models import Max, Q

from sentry import options
from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.framework import Pipeline
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.derived.tasks import process_group_log_task, rebuild_group_derived_data
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
# Derived by excluding identity and metadata fields from the model — new
# columns are automatically included unless explicitly excluded here.
_IDENTITY_FIELDS = frozenset({"id", "group_id", "date_added", "date_updated"})
_STATE_FIELDS = tuple(
    f.attname for f in GroupDerivedData._meta.concrete_fields if f.attname not in _IDENTITY_FIELDS
)


class RebuildId(NamedTuple):
    """Uniquely identifies a rebuild attempt for a group."""

    group_id: int
    generation_id: int
    pipeline_hash: str


# Cache for in-progress rebuild state.
_rebuild_cache = CacheMapping[RebuildId, GroupDerivedData](
    lambda k: f"{k.group_id}:{k.generation_id}:{k.pipeline_hash}",
    namespace="gdd-rebuild",
    ttl_seconds=86400,
)


class ProcessingStrategy(enum.Enum):
    SYNC = "sync"  # process all pending actions now
    ASYNC = "async"  # schedule a task to process all pending actions
    INLINE = "inline"  # try to process all pending actions quickly; fall back to ASYNC


def _ensure_derived(group_id: int, pipeline_hash: str) -> GroupDerivedData | None:
    """Get the GroupDerivedData row for a group, optionally creating one.

    When ``issues.derived-data.create-on-demand`` is enabled, a row is
    created if none exists. When disabled, returns None — processing will be
    a no-op until a backfill task creates and promotes a row.

    Raises Group.DoesNotExist if the group has been deleted.
    """
    try:
        return GroupDerivedData.objects.get(group_id=group_id)
    except GroupDerivedData.DoesNotExist:
        pass

    if not options.get("issues.derived-data.create-on-demand"):
        return None

    if not Group.objects.filter(id=group_id).exists():
        raise Group.DoesNotExist(f"Group {group_id} does not exist")

    generation_id = _current_generation_id(group_id)
    derived, _created = GroupDerivedData.objects.get_or_create(
        group_id=group_id,
        defaults={
            "generation_id": generation_id,
            "cursor_date": EPOCH,
            "cursor_id": 0,
            "data": {},
            "pipeline_hash": pipeline_hash,
        },
    )
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

    When *persist* is True (default), the update is written to the database
    with an optimistic concurrency guard that ensures the row's identity,
    generation, pipeline version, and cursor position haven't changed since
    we read it. If the guard fails (a concurrent writer or rebuild advanced
    the row), we refresh from the database and check for remaining work.

    When *persist* is False, only the in-memory object is updated — the
    caller is responsible for persisting the result (e.g. via
    ``promote_to_live``). Used for background rebuilds that accumulate
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
        Q(id=derived.id, generation_id=derived.generation_id)
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

    def __init__(self, group_id: int, rebuild_id: RebuildId | None = None) -> None:
        self.group_id = group_id
        self.rebuild_id = rebuild_id
        super().__init__(group_id)


DEFAULT_TIME_LIMIT = timedelta(seconds=8)


def _drain_log(
    derived: GroupDerivedData,
    batch_size: int = DEFAULT_BATCH_SIZE,
    pipeline: Pipeline[GroupActionLogEntry] | None = None,
    time_limit: timedelta = DEFAULT_TIME_LIMIT,
    *,
    persist: bool = True,
) -> bool:
    """Process pending log entries into *derived*, batching as needed.

    Returns True if all entries were processed, False if the time limit was
    reached and more entries remain. The limit is checked between batches,
    so a single slow batch can exceed it.

    When *persist* is False, batches update only the in-memory object.
    """
    deadline = time.monotonic() + time_limit.total_seconds()
    p = pipeline or PIPELINE
    while _process_batch(p, derived, batch_size, persist=persist):
        if time.monotonic() >= deadline:
            return False
    return True


# ---------------------------------------------------------------------------
# Live-row processing (incremental, on event arrival)
# ---------------------------------------------------------------------------


def process_group_log(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    pipeline: Pipeline[GroupActionLogEntry] | None = None,
    timeout: timedelta | None = None,
) -> GroupDerivedData | None:
    """Fully drain all pending entries for a group's row.

    Returns None if no row exists and on-demand creation is disabled.
    Raises Group.DoesNotExist if the group has been deleted.
    Raises GroupLogTimeout if *timeout* elapses before all
    entries are processed.
    """
    p = pipeline or PIPELINE

    with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
        derived = _ensure_derived(group_id, p.pipeline_hash)

    if derived is None:
        return None

    time_limit = timeout if timeout is not None else DEFAULT_TIME_LIMIT
    drained = _drain_log(derived, batch_size, p, time_limit=time_limit)
    if not drained:
        if timeout is not None:
            raise GroupLogTimeout(group_id)
        process_group_log_task.delay(group_id)

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

        if derived is None:
            return

        has_more = _process_batch(pipeline, derived, INLINE_BATCH_SIZE)
    if has_more:
        # Derived data will be stale for any code running between now and
        # when the task completes.
        metrics.incr("issues.derived.inline_fallback_to_async")
        process_group_log_task.delay(group_id)


# ---------------------------------------------------------------------------
# Rebuild lifecycle: build in memory, upsert live, cache partial progress
# ---------------------------------------------------------------------------


def _current_generation_id(group_id: int) -> int:
    """Return the current log generation for a group.

    This is ``max(id)`` from the action log, which directly encodes the
    log state at the moment a rebuild starts.
    """
    result = GroupActionLogEntry.objects.filter(group_id=group_id).aggregate(Max("id"))
    return result["id__max"] or 0


def _save_rebuild_state(rebuild_id: RebuildId, derived: GroupDerivedData) -> None:
    """Persist in-progress rebuild state to cache for later resumption."""
    _rebuild_cache.set(rebuild_id, derived)


def _load_rebuild_state(rebuild_id: RebuildId) -> GroupDerivedData | None:
    """Load in-progress rebuild state from cache into an unsaved instance."""
    return _rebuild_cache.get(rebuild_id)


class PromotionResult(enum.Enum):
    PROMOTED = "promoted"
    SUPERSEDED = "superseded"  # row has a newer generation_id
    CURSOR_BEHIND = "cursor_behind"  # same generation, cursor is ahead


def promote_to_live(candidate: GroupDerivedData) -> PromotionResult:
    """Upsert the candidate's state into the row for its group.

    If a row exists and the candidate's generation and cursor are at
    or ahead, the row is updated in place.  If no row exists, one is created.

    Returns SUPERSEDED when the row has a higher generation_id (a
    newer rebuild already won).  Returns CURSOR_BEHIND when the generation
    matches but the row's cursor is more advanced.

    The candidate object itself is not modified or persisted — it may be an
    unsaved in-memory instance used only to carry the computed state.
    """
    values = {f: getattr(candidate, f) for f in _STATE_FIELDS}

    # Try updating the existing row.  The guard requires that the
    # candidate's generation_id is >= the row's (so a stale rebuild
    # can't overwrite a newer one), and within the same generation the
    # cursor must be at or ahead.
    updated = (
        GroupDerivedData.objects.filter(
            group_id=candidate.group_id,
        )
        .filter(
            Q(generation_id__lt=candidate.generation_id)
            | Q(
                generation_id=candidate.generation_id,
                cursor_date__lt=candidate.cursor_date,
            )
            | Q(
                generation_id=candidate.generation_id,
                cursor_date=candidate.cursor_date,
                cursor_id__lte=candidate.cursor_id,
            )
        )
        .update(**values)
    )

    if updated:
        return PromotionResult.PROMOTED

    # No rows updated — either the row's generation/cursor is ahead,
    # or no row exists yet.  Try inserting; IntegrityError means a
    # row exists whose generation/cursor we didn't beat.  The
    # savepoint ensures the IntegrityError doesn't poison the outer
    # transaction, allowing the follow-up query to run.
    try:
        with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
            GroupDerivedData.objects.create(
                group_id=candidate.group_id,
                **values,
            )
    except IntegrityError:
        # Distinguish: is the row from a newer generation, or same
        # generation with a more advanced cursor?
        live_gen = (
            GroupDerivedData.objects.filter(group_id=candidate.group_id)
            .values_list("generation_id", flat=True)
            .first()
        )
        if live_gen is not None and live_gen > candidate.generation_id:
            return PromotionResult.SUPERSEDED
        return PromotionResult.CURSOR_BEHIND

    return PromotionResult.PROMOTED


MAX_PROMOTION_ATTEMPTS = 5


def build_and_promote_derived_data(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    rebuild_id: RebuildId | None = None,
    time_limit: timedelta = DEFAULT_TIME_LIMIT,
) -> None:
    """Build derived data from scratch and upsert into the row.

    The common path works entirely in memory: a transient GroupDerivedData
    is populated by draining the action log, then its state is upserted
    into the row (2-3 queries total for single-batch groups).

    When *rebuild_id* is provided, previously cached partial progress is
    loaded and resumed.  This happens after a prior run timed out and
    saved its state to cache.

    If promotion fails because the row's cursor is ahead (it received
    incremental updates while we were building), we drain additional entries
    to catch up and retry, bounded by MAX_PROMOTION_ATTEMPTS.

    Raises GroupLogTimeout (with ``rebuild_id`` set) if the time-limited
    drain could not finish, so the caller can re-enqueue.
    """
    derived: GroupDerivedData | None = None
    if rebuild_id is not None:
        derived = _load_rebuild_state(rebuild_id)
        if derived is None:
            logger.info(
                "issues.derived.build_and_promote.cache_miss",
                extra={"group_id": group_id, "rebuild_id": rebuild_id},
            )

    if derived is None:
        # Capture the current log generation before we start draining.
        # This lets promote_to_live reject stale rebuilds that started
        # before a later log mutation triggered a newer rebuild.
        generation_id = _current_generation_id(group_id)
        pipeline_hash = PIPELINE.pipeline_hash
        rebuild_id = RebuildId(group_id, generation_id, pipeline_hash)

        # In-memory only — cached on timeout for resumption.
        derived = GroupDerivedData(
            group_id=group_id,
            generation_id=generation_id,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=pipeline_hash,
        )
    else:
        rebuild_id = RebuildId(group_id, derived.generation_id, derived.pipeline_hash or "")

    result = PromotionResult.CURSOR_BEHIND
    attempt = 0
    for attempt in range(MAX_PROMOTION_ATTEMPTS):
        drained = _drain_log(derived, batch_size, time_limit=time_limit, persist=False)
        if not drained:
            _save_rebuild_state(rebuild_id, derived)
            raise GroupLogTimeout(group_id, rebuild_id=rebuild_id)

        result = promote_to_live(derived)
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
            _rebuild_cache.delete(rebuild_id)
            return

        if result is PromotionResult.SUPERSEDED:
            # A newer rebuild already won — retrying is futile.
            break

    _rebuild_cache.delete(rebuild_id)

    if result is PromotionResult.CURSOR_BEHIND:
        metrics.incr("issues.derived.promotion_exhausted", sample_rate=1.0)
        logger.warning(
            "issues.derived.promotion_exhausted",
            extra={
                "group_id": group_id,
                "attempts": attempt + 1,
            },
        )

    logger.info(
        "issues.derived.promotion_failed",
        extra={
            "group_id": group_id,
            "result": result.value,
        },
    )


# ---------------------------------------------------------------------------
# Invalidation
# ---------------------------------------------------------------------------


def invalidate_group_derived_data(
    group_id: int,
    cursor: tuple[datetime, int] | None = None,
    *,
    hard_delete: bool = True,
) -> None:
    """Invalidate derived state so it is rebuilt.

    *hard_delete* controls the strategy:

    - ``True`` (default): delete the row immediately and kick off an
      async task to rebuild from scratch. Use this when the existing data is
      known to be wrong and must not be served.
    - ``False``: leave the current row in place and kick off a background
      build-and-promote. The existing row continues serving reads until
      the replacement is ready.

    If *cursor* is ``(date_added, id)`` of the earliest affected entry, the
    invalidation only fires when the row's cursor is at or past that
    point; otherwise the mutation is still ahead of processing and no
    invalidation is needed. *cursor* is only meaningful with
    ``hard_delete=True``.
    """
    if not hard_delete:
        rebuild_group_derived_data.delay(group_id)
        return

    if cursor is None:
        GroupDerivedData.objects.filter(group_id=group_id).delete()
        rebuild_group_derived_data.delay(group_id)
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
        rebuild_group_derived_data.delay(group_id)
