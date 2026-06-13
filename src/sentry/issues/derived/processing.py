import logging
from dataclasses import dataclass
from datetime import datetime

from django.db import router, transaction
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
    """Get or create the GroupDerivedData row for a group.

    Raises Group.DoesNotExist if the group has been deleted.
    """
    try:
        return GroupDerivedData.objects.get(group_id=group_id)
    except GroupDerivedData.DoesNotExist:
        pass

    # Deferred to avoid circular import: group.py → action_log → processing.py
    from sentry.models.group import Group

    if not Group.objects.filter(id=group_id).exists():
        raise Group.DoesNotExist(f"Group {group_id} does not exist")

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
    """Process a single batch of pending entries. Schedules a task if not caught up.

    Raises Group.DoesNotExist if the group has been deleted.
    """
    with metrics.timer("issues.derived.process_batch"):
        p = target_pipeline or PIPELINE
        with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
            derived = _ensure_derived(group_id)
            has_more = _process_batch(p, derived, group_id, batch_size)
    return ProcessResult(derived=derived, caught_up=not has_more)


def process_group_log(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    target_pipeline: Pipeline | None = None,
) -> GroupDerivedData:
    """Fully drain all pending entries for a group, processing in batches.

    Raises Group.DoesNotExist if the group has been deleted.
    """
    p = target_pipeline or PIPELINE

    with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
        derived = _ensure_derived(group_id)
        has_more = _process_batch(p, derived, group_id, batch_size)

    while has_more:
        with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
            has_more = _process_batch(p, derived, group_id, batch_size)

    return derived


def invalidate_group_derived_data(
    group_id: int,
    cursor: tuple[datetime, int] | None = None,
) -> None:
    """Delete derived state so it is rebuilt from scratch on the next pass.

    If *cursor* is ``(date_added, id)`` of the earliest affected entry, the
    row is only deleted when its cursor is at or past that point; otherwise
    the mutation is still ahead of processing and no invalidation is needed.
    Without a cursor the invalidation is unconditional.
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
