import enum
import logging
import time
from datetime import datetime, timedelta

from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, router, transaction
from django.db.models import Q

from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.framework import Pipeline
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.derived.tasks import process_group_log_task
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


def _cursor_lte(cursor_date: datetime, cursor_id: int) -> Q:
    return Q(cursor_date__lt=cursor_date) | Q(cursor_date=cursor_date, cursor_id__lte=cursor_id)


def _process_batch(
    p: Pipeline[GroupActionLogEntry],
    derived: GroupDerivedData,
    group_id: int,
    batch_size: int,
) -> bool:
    """
    Process up to `batch_size` entries for a group. Updates derived in place.
    Returns True if there are more entries to process.

    Concurrency: multiple callers may process the same group simultaneously.
    Safety relies on two properties:

    1. The action log is append-only and the pipeline is deterministic, so
       any caller processing the same entries produces the same result.
    2. The UPDATE uses a cursor guard (_cursor_lte) that only succeeds if no
       other caller has already advanced the cursor past our batch. If it
       fails (updated == 0), a concurrent caller already wrote a superset
       of our work, so we refresh and check if more remains.

    This is an optimistic concurrency scheme — no locks are held, and the
    last-writer-wins semantics are safe because all writers compute the
    same deterministic result for overlapping entry ranges.
    """
    entries = _entries_after_cursor(group_id, derived.cursor_date, derived.cursor_id, batch_size)

    if not entries:
        return False

    result = p.run(entries, state=GroupDerivedDataStore.load(p, derived))

    last = entries[-1]
    last_date = last.date_added
    last_id = last.id
    state_update = GroupDerivedDataStore.build_update(p, result)

    updated = GroupDerivedData.objects.filter(
        Q(group_id=group_id)
        & _cursor_lte(last_date, last_id)
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
    """Raised when process_group_log cannot finish within its timeout."""


def process_group_log(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    target_pipeline: Pipeline[GroupActionLogEntry] | None = None,
    timeout: timedelta | None = None,
) -> GroupDerivedData:
    """Fully drain all pending entries for a group, processing in batches.

    Raises Group.DoesNotExist if the group has been deleted.
    Raises GroupLogTimeout if *timeout* elapses before all
    entries are processed.
    """
    p = target_pipeline or PIPELINE
    timeout_seconds = timeout.total_seconds() if timeout is not None else None
    start = time.monotonic()

    with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
        derived = _ensure_derived(group_id, p.pipeline_hash)

    has_more = _process_batch(p, derived, group_id, batch_size)
    while has_more:
        if timeout_seconds is not None and time.monotonic() - start >= timeout_seconds:
            raise GroupLogTimeout(group_id)
        has_more = _process_batch(p, derived, group_id, batch_size)

    return derived


def trigger_group_log_processing(group_id: int, *, strategy: ProcessingStrategy) -> None:
    """Trigger derived data processing for a group.

    Silently returns if the group has been deleted.

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

        has_more = _process_batch(pipeline, derived, group_id, INLINE_BATCH_SIZE)
    if has_more:
        # Derived data will be stale for any code running between now and
        # when the task completes.
        metrics.incr("issues.derived.inline_fallback_to_async")
        process_group_log_task.delay(group_id)


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
