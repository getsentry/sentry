import enum
import logging
import time
from datetime import datetime, timedelta
from typing import NamedTuple

from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils import timezone

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
# Derived by excluding identity, control, and auto-managed fields from the
# model — new columns are automatically included unless explicitly excluded.
_EXCLUDED_FIELDS = frozenset({"id", "group_id", "invalidated_at", "date_added", "date_updated"})
_STATE_FIELDS = tuple(
    f.attname for f in GroupDerivedData._meta.concrete_fields if f.attname not in _EXCLUDED_FIELDS
)


class RebuildId(NamedTuple):
    """Uniquely identifies a rebuild attempt for a group."""

    group_id: int
    invalidated_at: datetime | None  # None for hard-delete rebuilds
    pipeline_hash: str


# Cache for in-progress rebuild state.
_rebuild_cache = CacheMapping[RebuildId, GroupDerivedData](
    lambda k: f"{k.group_id}:{k.invalidated_at.isoformat() if k.invalidated_at else 'deleted'}:{k.pipeline_hash}",
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

    derived, _created = GroupDerivedData.objects.get_or_create(
        group_id=group_id,
        defaults={
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
    invalidation state, pipeline version, and cursor position haven't
    changed since we read it. If the guard fails (a concurrent writer or
    rebuild advanced the row), we refresh from the database and check for
    remaining work.

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
        Q(id=derived.id, invalidated_at=derived.invalidated_at)
        & (Q(cursor_date__lt=last_date) | Q(cursor_date=last_date, cursor_id__lte=last_id))
        & Q(pipeline_hash=derived.pipeline_hash)
    ).update(cursor_date=last_date, cursor_id=last_id, **state_update)

    if updated:
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
        metrics.incr("issues.derived.inline_fallback_to_async")
        process_group_log_task.delay(group_id)


# ---------------------------------------------------------------------------
# Rebuild lifecycle: build in memory, upsert, cache partial progress
# ---------------------------------------------------------------------------


class PromotionResult(enum.Enum):
    PROMOTED = "promoted"
    SUPERSEDED = "superseded"  # a newer invalidation arrived; our work is stale
    CURSOR_BEHIND = "cursor_behind"  # same invalidation, but cursor is more advanced


def promote_to_live(
    candidate: GroupDerivedData,
    invalidated_at: datetime,
) -> PromotionResult:
    """Upsert the candidate's state into the row for its group.

    Clears ``invalidated_at`` atomically on success via a CAS: the UPDATE
    only matches if ``invalidated_at`` still equals the value we observed
    when the rebuild started.  If a newer invalidation arrived, the CAS
    fails and the row stays flagged.

    Returns SUPERSEDED if ``invalidated_at`` changed (newer invalidation).
    Returns CURSOR_BEHIND if the cursor guard failed within the same
    invalidation.

    The candidate object itself is not modified or persisted.
    """
    values = {f: getattr(candidate, f) for f in _STATE_FIELDS}

    # CAS: clear invalidated_at only if it still matches what we observed.
    updated = (
        GroupDerivedData.objects.filter(
            group_id=candidate.group_id,
            invalidated_at=invalidated_at,
        )
        .filter(
            Q(cursor_date__lt=candidate.cursor_date)
            | Q(cursor_date=candidate.cursor_date, cursor_id__lte=candidate.cursor_id)
        )
        .update(invalidated_at=None, **values)
    )

    if updated:
        return PromotionResult.PROMOTED

    # Check why we failed: row missing, invalidated_at changed, or cursor?
    row = (
        GroupDerivedData.objects.filter(group_id=candidate.group_id)
        .values_list("id", "invalidated_at")
        .first()
    )

    if row is None:
        # Row was deleted between our read and the CAS — the rebuild
        # that deleted it will handle recreation.
        return PromotionResult.SUPERSEDED

    _row_id, current_invalidated_at = row
    if current_invalidated_at != invalidated_at:
        return PromotionResult.SUPERSEDED
    return PromotionResult.CURSOR_BEHIND


MAX_PROMOTION_ATTEMPTS = 5


def _build_and_insert(
    group_id: int,
    batch_size: int,
    rebuild_id: RebuildId | None,
    time_limit: timedelta,
) -> None:
    """Build derived data from scratch and INSERT a new row.

    Used after a hard-delete invalidation where no row exists.  No CAS
    is needed — if a concurrent writer creates the row first, the INSERT
    fails harmlessly.
    """
    pipeline_hash = PIPELINE.pipeline_hash
    current_rebuild_id = RebuildId(group_id, None, pipeline_hash)

    derived: GroupDerivedData | None = None
    if rebuild_id is not None and rebuild_id == current_rebuild_id:
        derived = _rebuild_cache.get(rebuild_id)

    if derived is None:
        derived = GroupDerivedData(
            group_id=group_id,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=pipeline_hash,
        )

    drained = _drain_log(derived, batch_size, time_limit=time_limit, persist=False)
    if not drained:
        _rebuild_cache.set(current_rebuild_id, derived)
        raise GroupLogTimeout(group_id, rebuild_id=current_rebuild_id)

    values = {f: getattr(derived, f) for f in _STATE_FIELDS}
    try:
        with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
            GroupDerivedData.objects.create(group_id=group_id, **values)
    except IntegrityError:
        # A concurrent writer already created the row — that's fine.
        logger.info("issues.derived.insert_race_lost", extra={"group_id": group_id})

    _rebuild_cache.delete(current_rebuild_id)


def build_and_promote_derived_data(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    rebuild_id: RebuildId | None = None,
    time_limit: timedelta = DEFAULT_TIME_LIMIT,
) -> None:
    """Build derived data from scratch and upsert into the row.

    The common path works entirely in memory: a transient GroupDerivedData
    is populated by draining the action log, then its state is upserted
    into the row via a CAS on ``invalidated_at``.

    When *rebuild_id* is provided, previously cached partial progress is
    loaded and resumed.

    The rebuild can bail early between batches if it detects that
    ``invalidated_at`` changed on the row (a newer invalidation arrived),
    avoiding wasted work.

    Raises GroupLogTimeout (with ``rebuild_id`` set) if the time-limited
    drain could not finish, so the caller can re-enqueue.
    """
    # Determine which invalidation we're serving (if any).
    # Single query: None means no row; (id, None) means row not invalidated.
    row = (
        GroupDerivedData.objects.filter(group_id=group_id)
        .values_list("id", "invalidated_at")
        .first()
    )
    if row is not None:
        _row_id, invalidated_at = row
        if invalidated_at is None:
            # Row exists but is not invalidated — nothing to rebuild.
            return
    else:
        # Row was hard-deleted — rebuild from scratch via INSERT.
        return _build_and_insert(group_id, batch_size, rebuild_id, time_limit)

    pipeline_hash = PIPELINE.pipeline_hash
    current_rebuild_id = RebuildId(group_id, invalidated_at, pipeline_hash)

    # Try to resume from cache.
    derived: GroupDerivedData | None = None
    if rebuild_id is not None:
        if rebuild_id == current_rebuild_id:
            derived = _rebuild_cache.get(rebuild_id)
        if derived is None:
            logger.info(
                "issues.derived.build_and_promote.cache_miss",
                extra={"group_id": group_id, "rebuild_id": rebuild_id},
            )

    if derived is None:
        derived = GroupDerivedData(
            group_id=group_id,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=pipeline_hash,
        )

    result = PromotionResult.CURSOR_BEHIND
    attempt = 0
    for attempt in range(MAX_PROMOTION_ATTEMPTS):
        drained = _drain_log(derived, batch_size, time_limit=time_limit, persist=False)
        if not drained:
            _rebuild_cache.set(current_rebuild_id, derived)
            raise GroupLogTimeout(group_id, rebuild_id=current_rebuild_id)

        result = promote_to_live(derived, invalidated_at)
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
            _rebuild_cache.delete(current_rebuild_id)
            return

        if result is PromotionResult.SUPERSEDED:
            # A newer invalidation already won — retrying is futile.
            break

    _rebuild_cache.delete(current_rebuild_id)

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
    hard_delete: bool = False,
) -> None:
    """Invalidate derived state so it is rebuilt.

    *hard_delete* controls the strategy:

    - ``False`` (default): flag the row with ``invalidated_at`` and kick
      off a background rebuild. The existing row continues serving reads
      until the rebuild completes and clears the flag.
    - ``True``: delete the row immediately and kick off an async task to
      rebuild from scratch. Use this when the existing data is known to
      be wrong and must not be served.

    If *cursor* is ``(date_added, id)`` of the earliest affected entry, the
    invalidation only fires when the row's cursor is at or past that
    point; otherwise the mutation is still ahead of processing and no
    invalidation is needed.
    """
    now = timezone.now()

    if cursor is None:
        # Unconditional invalidation — always enqueue the rebuild.
        if hard_delete:
            GroupDerivedData.objects.filter(group_id=group_id).delete()
        else:
            GroupDerivedData.objects.filter(group_id=group_id).update(invalidated_at=now)
        rebuild_group_derived_data.delay(group_id)
        return

    # Cursor-guarded: only invalidate if the row has processed past
    # the affected log entry.
    cursor_date, cursor_id = cursor
    qs = GroupDerivedData.objects.filter(
        Q(group_id=group_id)
        & (Q(cursor_date__gt=cursor_date) | Q(cursor_date=cursor_date, cursor_id__gte=cursor_id))
    )

    if hard_delete:
        affected, _ = qs.delete()
    else:
        affected = qs.update(invalidated_at=now)

    if affected:
        logger.info(
            "issues.derived.invalidated",
            extra={
                "group_id": group_id,
                "cursor_date": str(cursor_date),
                "cursor_id": cursor_id,
            },
        )
        rebuild_group_derived_data.delay(group_id)
