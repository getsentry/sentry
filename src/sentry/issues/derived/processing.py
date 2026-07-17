import enum
import logging
import time
from datetime import UTC, datetime, timedelta

from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, router, transaction
from django.db.models import Max, Q

from sentry import options
from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.framework import Pipeline
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.derived.tasks import process_group_log_task, rebuild_group_derived_data_task
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import EPOCH, GroupDerivedData
from sentry.models.group import Group
from sentry.utils import metrics

logger = logging.getLogger(__name__)

PIPELINE: Pipeline[GroupActionLogEntry] = Pipeline(AGGREGATORS)

DEFAULT_BATCH_SIZE = 1000
INLINE_BATCH_SIZE = 100

# Fields that constitute the derived state, used by promote_to_live upsert.
_STATE_FIELDS = (
    "generation_id",
    "cursor_date",
    "cursor_id",
    "data",
    "view_count",
    "progress",
    "last_progressed_at",
    "pipeline_hash",
)


class ProcessingStrategy(enum.Enum):
    SYNC = "sync"  # process all pending actions now
    ASYNC = "async"  # schedule a task to process all pending actions
    INLINE = "inline"  # try to process all pending actions quickly; fall back to ASYNC


def _ensure_derived(group_id: int, pipeline_hash: str) -> GroupDerivedData | None:
    """Get the live GroupDerivedData row for a group, optionally creating one.

    When ``issues.derived-data.create-on-demand`` is enabled, a live row is
    created if none exists. When disabled, returns None — processing will be
    a no-op until a backfill task creates and promotes a row.

    Raises Group.DoesNotExist if the group has been deleted.
    """
    # Fast path: read-only check avoids a write attempt when the row exists
    # or when on-demand creation is disabled.
    try:
        return GroupDerivedData.objects.get(group_id=group_id, is_live=True)
    except GroupDerivedData.DoesNotExist:
        pass

    if not options.get("issues.derived-data.create-on-demand"):
        return None

    if not Group.objects.filter(id=group_id).exists():
        raise Group.DoesNotExist(f"Group {group_id} does not exist")

    generation_id = _current_generation_id(group_id)
    derived, _created = GroupDerivedData.objects.get_or_create(
        group_id=group_id,
        is_live=True,
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
    with an optimistic concurrency guard scoped to the row's id and
    generation_id. The generation_id check ensures that if a rebuild
    promoted a new generation between our read and write, we discard our
    work (which was computed from the old generation's state) and refresh.

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

    def __init__(self, group_id: int, derived_id: int | None = None) -> None:
        self.group_id = group_id
        self.derived_id = derived_id
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
    """Fully drain all pending entries for a group's live row.

    Returns None if no live row exists and on-demand creation is disabled.
    Raises Group.DoesNotExist if the group has been deleted.
    Raises GroupLogTimeout if *timeout* elapses before all
    entries are processed.
    """
    p = pipeline or PIPELINE

    with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
        derived = _ensure_derived(group_id, p.pipeline_hash)

    if derived is None:
        return None

    if timeout is not None:
        timeout_seconds = timeout.total_seconds()
        start = time.monotonic()
        has_more = _process_batch(p, derived, batch_size)
        while has_more:
            if time.monotonic() - start >= timeout_seconds:
                raise GroupLogTimeout(group_id)
            has_more = _process_batch(p, derived, batch_size)
    else:
        drained = _drain_log(derived, batch_size, p)
        if not drained:
            process_group_log_task.delay(group_id)

    return derived


def trigger_group_log_processing(group_id: int, *, strategy: ProcessingStrategy) -> None:
    """Trigger derived data processing for a group.

    Silently returns if the group has been deleted or no live row exists.

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
# Non-live row lifecycle: build in memory, upsert live, cleanup
# ---------------------------------------------------------------------------


def create_processing_row(group_id: int) -> GroupDerivedData:
    """Create a new non-live GroupDerivedData row for background processing.

    Primarily used for saving partial progress on timeout so a subsequent
    task can resume. For normal builds, prefer an unsaved in-memory instance
    via ``build_and_promote_derived_data``.
    """
    return GroupDerivedData.objects.create(
        group_id=group_id,
        is_live=False,
        cursor_date=EPOCH,
        cursor_id=0,
        data={},
    )


def _current_generation_id(group_id: int) -> int:
    """Return the current log generation for a group.

    This is ``max(id)`` from the action log, which directly encodes the
    log state at the moment a rebuild starts.  The index on
    ``(group_id, date_added, id)`` makes this an index-only backward scan.
    """
    result = GroupActionLogEntry.objects.filter(group_id=group_id).aggregate(Max("id"))
    return result["id__max"] or 0


class PromotionResult(enum.Enum):
    PROMOTED = "promoted"
    CURSOR_BEHIND = "cursor_behind"


def promote_to_live(candidate: GroupDerivedData) -> PromotionResult:
    """Upsert the candidate's state into the live row for its group.

    If a live row exists and the candidate's generation and cursor are at
    or ahead of the live row, the live row is updated in place.  If no live
    row exists, one is created.

    Returns CURSOR_BEHIND when the existing live row has a higher
    generation_id (a newer rebuild supersedes us) or a more advanced cursor
    within the same generation.

    The candidate object itself is not modified or persisted — it may be an
    unsaved in-memory instance used only to carry the computed state.
    """
    values = {f: getattr(candidate, f) for f in _STATE_FIELDS}

    # Try updating the existing live row.  The guard requires that the
    # candidate's generation_id is >= the live row's (so a stale rebuild
    # can't overwrite a newer one), and within the same generation the
    # cursor must be at or ahead.
    updated = (
        GroupDerivedData.objects.filter(
            group_id=candidate.group_id,
            is_live=True,
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

    # No rows updated — either the live row's generation/cursor is ahead,
    # or no live row exists yet.  Try inserting; IntegrityError means a
    # live row exists whose generation/cursor we didn't beat.
    try:
        GroupDerivedData.objects.create(
            group_id=candidate.group_id,
            is_live=True,
            **values,
        )
    except IntegrityError:
        return PromotionResult.CURSOR_BEHIND

    return PromotionResult.PROMOTED


MAX_PROMOTION_ATTEMPTS = 5


def build_and_promote_derived_data(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    derived_id: int | None = None,
    time_limit: timedelta = DEFAULT_TIME_LIMIT,
) -> None:
    """Build derived data from scratch and upsert into the live row.

    The common path works entirely in memory: a transient GroupDerivedData
    is populated by draining the action log, then its state is upserted
    into the live row (2-3 queries total for single-batch groups).

    When *derived_id* is provided, a previously persisted non-live row is
    loaded and resumed.  This happens after a prior run timed out and saved
    its partial progress to the database.

    If promotion fails because the live row's cursor is ahead (it received
    incremental updates while we were building), we drain additional entries
    to catch up and retry, bounded by MAX_PROMOTION_ATTEMPTS.

    Raises GroupLogTimeout (with ``derived_id`` set) if the time-limited
    drain could not finish, so the caller can re-enqueue with the id.
    """
    if derived_id is not None:
        derived = GroupDerivedData.objects.filter(id=derived_id, is_live=False).first()
        if derived is None:
            logger.info(
                "issues.derived.build_and_promote.no_row",
                extra={"group_id": group_id, "derived_id": derived_id},
            )
            return
    else:
        # Capture the current log generation before we start draining.
        # This lets promote_to_live reject stale rebuilds that started
        # before a later log mutation triggered a newer rebuild.
        generation_id = _current_generation_id(group_id)

        # In-memory only — not saved to the database unless we time out.
        derived = GroupDerivedData(
            group_id=group_id,
            is_live=False,
            generation_id=generation_id,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )

    result = PromotionResult.CURSOR_BEHIND
    for attempt in range(MAX_PROMOTION_ATTEMPTS):
        drained = _drain_log(derived, batch_size, time_limit=time_limit, persist=False)
        if not drained:
            # Save to DB for resumption if not already persisted.
            if derived.pk is None:
                derived.save()
            raise GroupLogTimeout(group_id, derived_id=derived.pk)

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
            # Clean up the non-live row if it was persisted for resumption.
            if derived.pk is not None:
                derived.delete()
            return

    # Clean up non-live row if persisted.
    if derived.pk is not None:
        derived.delete()

    if result is PromotionResult.CURSOR_BEHIND:
        metrics.incr("issues.derived.promotion_exhausted", sample_rate=1.0)
        logger.warning(
            "issues.derived.promotion_exhausted",
            extra={
                "group_id": group_id,
                "attempts": MAX_PROMOTION_ATTEMPTS,
            },
        )

    logger.info(
        "issues.derived.promotion_rejected",
        extra={
            "group_id": group_id,
            "result": result.value,
        },
    )


def cleanup_stale_processing_rows(
    max_age: timedelta = timedelta(days=2),
) -> int:
    """Delete non-live rows older than *max_age* that were never promoted."""
    cutoff = datetime.now(UTC) - max_age
    deleted, _ = GroupDerivedData.objects.filter(
        is_live=False,
        date_added__lt=cutoff,
    ).delete()
    return deleted


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

    - ``True`` (default): delete the live row immediately and kick off an
      async task to rebuild from scratch. Use this when the existing data is
      known to be wrong and must not be served.
    - ``False``: leave the current live row in place and kick off a background
      build-and-promote. The existing live row continues serving reads until
      the replacement is ready.

    If *cursor* is ``(date_added, id)`` of the earliest affected entry, the
    invalidation only fires when the live row's cursor is at or past that
    point; otherwise the mutation is still ahead of processing and no
    invalidation is needed. *cursor* is only meaningful with
    ``hard_delete=True``.
    """
    if not hard_delete:
        rebuild_group_derived_data_task.delay(group_id)
        return

    if cursor is None:
        GroupDerivedData.objects.filter(group_id=group_id, is_live=True).delete()
        rebuild_group_derived_data_task.delay(group_id)
        return

    # Only invalidate if the row has already processed past the affected point.
    cursor_date, cursor_id = cursor
    deleted, _ = GroupDerivedData.objects.filter(
        Q(group_id=group_id, is_live=True)
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
        rebuild_group_derived_data_task.delay(group_id)
