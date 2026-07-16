import enum
import logging
import time
from datetime import UTC, datetime, timedelta

from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, router, transaction
from django.db.models import Q

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

    derived, _created = GroupDerivedData.objects.get_or_create(
        group_id=group_id,
        is_live=True,
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
) -> bool:
    """
    Process up to `batch_size` entries for a group. Updates derived in place.
    Returns True if there are more entries to process.

    Concurrency: multiple callers may process the same row simultaneously.
    Safety relies on two properties:

    1. The action log is append-only and the pipeline is deterministic, so
       any caller processing the same entries produces the same result.
    2. The UPDATE uses a cursor guard scoped to the specific row (by id)
       and pipeline_hash that only succeeds if no other caller has already
       advanced the cursor past our batch. If it fails (updated == 0), a
       concurrent caller already wrote a superset of our work, so we
       refresh and check if more remains.

    This is an optimistic concurrency scheme — no locks are held, and the
    last-writer-wins semantics are safe because all writers compute the
    same deterministic result for overlapping entry ranges.
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

    updated = GroupDerivedData.objects.filter(
        Q(id=derived.id)
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
) -> bool:
    """Process pending log entries into *derived*, batching as needed.

    Returns True if all entries were processed, False if the time limit was
    reached and more entries remain. The limit is checked between batches,
    so a single slow batch can exceed it.
    """
    deadline = time.monotonic() + time_limit.total_seconds()
    p = pipeline or PIPELINE
    while _process_batch(p, derived, batch_size):
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
# Non-live row lifecycle: create, build, promote, cleanup
# ---------------------------------------------------------------------------


def create_processing_row(group_id: int) -> GroupDerivedData:
    """Create a new non-live GroupDerivedData row for background processing."""
    return GroupDerivedData.objects.create(
        group_id=group_id,
        is_live=False,
        cursor_date=EPOCH,
        cursor_id=0,
        data={},
    )


class PromotionResult(enum.Enum):
    PROMOTED = "promoted"
    CURSOR_BEHIND = "cursor_behind"
    SUPERSEDED = "superseded"
    CANDIDATE_MISSING = "candidate_missing"
    RACE_LOST = "race_lost"


class _PromotionAborted(Exception):
    pass


def promote_to_live(candidate: GroupDerivedData) -> PromotionResult:
    """Atomically promote a non-live row to live, replacing any existing live row.

    On success the old live row is deleted within the same transaction.
    On any failure the transaction rolls back, restoring the old live row.
    """
    try:
        with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
            current_live = GroupDerivedData.objects.filter(
                group_id=candidate.group_id, is_live=True
            ).first()

            if current_live is not None:
                # A candidate older than the live row means a concurrent or
                # earlier build is trying to replace a newer one — reject it.
                if candidate.id < current_live.id:
                    return PromotionResult.SUPERSEDED
                if (candidate.cursor_date, candidate.cursor_id) < (
                    current_live.cursor_date,
                    current_live.cursor_id,
                ):
                    return PromotionResult.CURSOR_BEHIND
                current_live.delete()

            updated = GroupDerivedData.objects.filter(id=candidate.id).update(is_live=True)
            if not updated:
                raise _PromotionAborted

            candidate.is_live = True
    except _PromotionAborted:
        return PromotionResult.CANDIDATE_MISSING
    except IntegrityError:
        return PromotionResult.RACE_LOST

    return PromotionResult.PROMOTED


MAX_PROMOTION_ATTEMPTS = 5


def _get_or_create_processing_row(group_id: int, derived_id: int | None) -> GroupDerivedData | None:
    """Resume an existing non-live row by id, or create a new one.

    Returns None if creation fails (IntegrityError) or the requested row
    no longer exists (cleaned up).
    """
    if derived_id is not None:
        return GroupDerivedData.objects.filter(id=derived_id, is_live=False).first()
    try:
        return create_processing_row(group_id)
    except IntegrityError:
        return None


def build_and_promote_derived_data(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    derived_id: int | None = None,
    time_limit: timedelta = DEFAULT_TIME_LIMIT,
) -> None:
    """Create (or resume) a non-live row, drain the log into it, and promote.

    When *derived_id* is provided, an existing non-live row is resumed instead
    of creating a new one. This allows the task to be re-enqueued and pick up
    where it left off after a time-limited drain.

    If promotion fails because the live row's cursor is ahead (it received
    incremental updates while we were building), we drain additional entries
    to catch up and retry. This avoids discarding a rebuild that contains
    corrected historical data just because the live row is more current.

    Retries are bounded to avoid starvation if the live row is being updated
    faster than we can catch up. On exhaustion the caller should re-enqueue.

    Raises GroupLogTimeout (with ``derived_id`` set) if the time-limited drain
    could not finish, so the caller can decide its own retry strategy.
    """
    derived = _get_or_create_processing_row(group_id, derived_id)
    if derived is None:
        logger.info(
            "issues.derived.build_and_promote.no_row",
            extra={"group_id": group_id, "derived_id": derived_id},
        )
        return

    result = PromotionResult.CURSOR_BEHIND
    for attempt in range(MAX_PROMOTION_ATTEMPTS):
        drained = _drain_log(derived, batch_size, time_limit=time_limit)
        if not drained:
            raise GroupLogTimeout(group_id, derived_id=derived.id)
        result = promote_to_live(derived)
        if result is PromotionResult.PROMOTED:
            logger.info(
                "issues.derived.promoted",
                extra={
                    "group_id": group_id,
                    "derived_id": derived.id,
                    "cursor_date": str(derived.cursor_date),
                    "cursor_id": derived.cursor_id,
                    "attempts": attempt + 1,
                },
            )
            return

        if result is not PromotionResult.CURSOR_BEHIND:
            break

    derived.delete()

    if result is PromotionResult.CURSOR_BEHIND:
        metrics.incr("issues.derived.promotion_exhausted", sample_rate=1.0)
        logger.warning(
            "issues.derived.promotion_exhausted",
            extra={
                "group_id": group_id,
                "derived_id": derived.id,
                "attempts": MAX_PROMOTION_ATTEMPTS,
            },
        )

    logger.info(
        "issues.derived.promotion_rejected",
        extra={
            "group_id": group_id,
            "derived_id": derived.id,
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
