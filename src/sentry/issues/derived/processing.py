import logging
from dataclasses import dataclass
from datetime import datetime

from django.db.models import Q

from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.framework import Pipeline
from sentry.issues.derived.groupderiveddata import EPOCH, GroupDerivedData
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.groupactionlogentry import GroupActionLogEntry

logger = logging.getLogger(__name__)

pipeline = Pipeline(AGGREGATORS, version=1)

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
    p = target_pipeline or pipeline
    derived = _ensure_derived(group_id)
    has_more = _process_batch(p, derived, group_id, batch_size)
    return ProcessResult(derived=derived, caught_up=not has_more)


def process_group_log(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    target_pipeline: Pipeline | None = None,
) -> GroupDerivedData:
    """Fully drain all pending entries for a group, processing in batches."""
    p = target_pipeline or pipeline
    derived = _ensure_derived(group_id)

    while _process_batch(p, derived, group_id, batch_size):
        pass

    return derived
