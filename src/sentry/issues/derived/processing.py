import logging
from dataclasses import dataclass
from datetime import datetime

from django.db.models import Q

from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.framework import Pipeline
from sentry.issues.derived.groupderiveddata import EPOCH, GroupDerivedData
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.groupactionlogentry import GroupActionLogEntry
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Pipeline with current aggregators. Versioned because in principle
# we may want to change it in place and correlate that to existing derived data
# for invalidation purposes.
# TODO: Shouldn't it be versioned by a feature set hash? To be sorted out later.
PIPELINE = Pipeline(AGGREGATORS, version=1)

DEFAULT_BATCH_SIZE = 1000
INLINE_BATCH_SIZE = 100


@dataclass
class ProcessResult:
    derived: GroupDerivedData
    caught_up: bool


def _ensure_derived(group_id: int) -> GroupDerivedData:
    try:
        return GroupDerivedData.objects.get(group_id=group_id)
    except GroupDerivedData.DoesNotExist:
        pass

    derived, _created = GroupDerivedData.objects.get_or_create(
        group_id=group_id,
        defaults={"cursor_date": EPOCH, "cursor_id": 0, "data": {}},
    )
    return derived


def _entries_after_cursor(
    group_id: int, cursor_date: datetime, cursor_id: int, batch_size: int
) -> list[GroupActionLogEntry]:
    return list(
        GroupActionLogEntry.objects.filter(
            Q(group_id=group_id)
            & (Q(date_added__gt=cursor_date) | Q(date_added=cursor_date, id__gt=cursor_id))
        ).order_by("date_added", "id")[:batch_size]
    )


def _cursor_lte(cursor_date: datetime, cursor_id: int) -> Q:
    return Q(cursor_date__lt=cursor_date) | Q(cursor_date=cursor_date, cursor_id__lte=cursor_id)


def _process_batch(
    p: Pipeline,
    derived: GroupDerivedData,
    group_id: int,
    batch_size: int,
) -> bool:
    """
    Process up to `batch_size` entries for a group. Updates derived in place.
    Returns True if there are more entries to process.
    """
    entries = _entries_after_cursor(group_id, derived.cursor_date, derived.cursor_id, batch_size)

    if not entries:
        return False

    state = GroupDerivedDataStore.load(p, derived)
    for entry in entries:
        state = p.step(state, entry)

    last = entries[-1]
    last_date = last.date_added
    last_id = last.id
    state_update = GroupDerivedDataStore.build_update(p, state)

    updated = GroupDerivedData.objects.filter(
        Q(group_id=group_id) & _cursor_lte(last_date, last_id)
    ).update(cursor_date=last_date, cursor_id=last_id, **state_update)

    if updated:
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
        derived.refresh_from_db()
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


def process_group_log_batch(
    group_id: int,
    batch_size: int = INLINE_BATCH_SIZE,
    target_pipeline: Pipeline | None = None,
) -> ProcessResult:
    """Process a single batch of pending entries. Schedules a task if not caught up."""
    with metrics.timer("issues.derived.process_batch"):
        p = target_pipeline or PIPELINE
        derived = _ensure_derived(group_id)
        has_more = _process_batch(p, derived, group_id, batch_size)
    return ProcessResult(derived=derived, caught_up=not has_more)


def process_group_log(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    target_pipeline: Pipeline | None = None,
) -> GroupDerivedData:
    """Fully drain all pending entries for a group, processing in batches."""
    p = target_pipeline or PIPELINE
    derived = _ensure_derived(group_id)

    while _process_batch(p, derived, group_id, batch_size):
        pass

    return derived


def invalidate_group_derived_data(
    group_id: int,
    cursor: tuple[datetime, int] | None = None,
) -> None:
    """Invalidate derived state when the action log has been mutated.

    Call this when entries have been inserted, modified, or deleted in a way
    that means the materialised GroupDerivedData no longer reflects the true
    state of the log — e.g. after back-filling historical actions or deleting
    entries that were written in error.

    If *cursor* is provided as ``(date_added, id)`` of the earliest affected
    entry, the row is reset to just before that point so only the affected
    suffix is reprocessed.  Without a cursor the entire row is deleted and
    will be rebuilt from scratch on the next processing pass.
    """
    if cursor is None:
        GroupDerivedData.objects.filter(group_id=group_id).delete()
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
