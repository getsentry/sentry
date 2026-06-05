import logging
from dataclasses import dataclass
from datetime import datetime

from django.db import router, transaction
from django.db.models import Q

from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.lib import Pipeline
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.groupactionlogentry import GroupActionLogEntry
from sentry.models.groupderiveddata import EPOCH, GroupDerivedData

logger = logging.getLogger(__name__)

# The current pipeline definition. Bump the version when aggregator logic
# changes. GroupDerivedData rows are scoped to the pipeline version that
# produced them — different versions coexist independently.
pipeline = Pipeline(AGGREGATORS, version=1)

DEFAULT_BATCH_SIZE = 1000
INLINE_BATCH_SIZE = 100


@dataclass
class ProcessResult:
    derived: GroupDerivedData
    caught_up: bool


def _ensure_derived(group_id: int, version: int) -> tuple[GroupDerivedData, bool]:
    try:
        return GroupDerivedData.objects.get(group_id=group_id, version=version), False
    except GroupDerivedData.DoesNotExist:
        pass

    with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
        derived, created = GroupDerivedData.objects.get_or_create(
            group_id=group_id,
            version=version,
            defaults={"cursor_date": EPOCH, "cursor_id": 0, "data": {}, "primary": True},
        )
        if created:
            GroupDerivedData.objects.filter(
                group_id=group_id,
                primary=True,
            ).exclude(id=derived.id).update(primary=False)
    return derived, created


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
    version = p.version

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
        Q(group_id=group_id, version=version) & _cursor_lte(last_date, last_id)
    ).update(cursor_date=last_date, cursor_id=last_id, **state_update)

    if updated:
        derived.cursor_date = last_date
        derived.cursor_id = last_id
        GroupDerivedDataStore.apply_to_instance(derived, state_update)
        logger.info(
            "issues.derived.processed",
            extra={
                "group_id": group_id,
                "version": version,
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
                "version": version,
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
    """
    Process a single batch of pending entries for a group.

    Returns a ProcessResult with the derived data and whether it's fully
    caught up. Callers that want synchronous-when-possible behavior should
    call this, check caught_up, and schedule the task for the remainder.
    """
    p = target_pipeline or pipeline
    derived, _created = _ensure_derived(group_id, p.version)
    has_more = _process_batch(p, derived, group_id, batch_size)
    return ProcessResult(derived=derived, caught_up=not has_more)


def process_group_log(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    target_pipeline: Pipeline | None = None,
) -> GroupDerivedData:
    """
    Fully drain all pending entries for a group, processing in batches.

    This is the version used by the background task. For inline/synchronous
    use, prefer process_group_log_batch (via record()).
    """
    p = target_pipeline or pipeline
    derived, _created = _ensure_derived(group_id, p.version)

    while _process_batch(p, derived, group_id, batch_size):
        pass

    return derived


def promote_primary(group_id: int, version: int) -> bool:
    """
    Make the given version's row the primary for this group.

    Demotes any other primary row. Returns True if the target row exists
    and was promoted, False if no row exists for that version.
    """
    with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
        updated = GroupDerivedData.objects.filter(
            group_id=group_id,
            version=version,
        ).update(primary=True)

        if updated:
            GroupDerivedData.objects.filter(
                group_id=group_id,
                primary=True,
            ).exclude(version=version).update(primary=False)
            return True
    return False
