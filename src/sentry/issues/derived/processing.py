from __future__ import annotations

import logging
from dataclasses import dataclass

from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.lib import Pipeline
from sentry.models.groupderiveddata import GroupDerivedData
from sentry.models.issueactionlog import IssueActionLog

logger = logging.getLogger(__name__)

# The current pipeline definition. Bump the version when aggregator logic
# changes. GroupDerivedData rows are scoped to the pipeline version that
# produced them — different versions coexist independently.
#
# Multi-version lifecycle (not yet automated):
#   1. Old pipeline (version N) is primary and continues processing.
#   2. New pipeline (version N+1) is deployed. It creates fresh rows
#      from cursor=0 with primary=False.
#   3. A backfill job reprocesses all groups at version N+1.
#   4. Once a group's N+1 row is caught up, promote_primary() flips
#      primary to the new row.
#   5. Version-N rows are eligible for cleanup.
#
# For now, process_group_log always marks its row as primary (simple
# single-version policy). The promote_primary helper exists for future
# use when the transition needs finer control.
pipeline = Pipeline(AGGREGATORS, version=1)

DEFAULT_BATCH_SIZE = 1000
INLINE_BATCH_SIZE = 100


@dataclass
class ProcessResult:
    derived: GroupDerivedData
    caught_up: bool


def _ensure_derived(group_id: int, version: int) -> tuple[GroupDerivedData, bool]:
    """Get or create the GroupDerivedData row, handling primary demotion for new rows."""
    derived, created = GroupDerivedData.objects.get_or_create(
        group_id=group_id,
        version=version,
        defaults={"cursor": 0, "data": {}, "primary": True},
    )
    if created:
        GroupDerivedData.objects.filter(
            group_id=group_id,
            primary=True,
        ).exclude(id=derived.id).update(primary=False)
    return derived, created


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

    entries = list(
        IssueActionLog.objects.filter(
            group_id=group_id,
            id__gt=derived.cursor,
        ).order_by("id")[:batch_size]
    )

    if not entries:
        return False

    state = p.load_state(derived.data)
    for entry in entries:
        state = p.step(state, entry)

    last_id = entries[-1].id
    new_data = p.dump_state(state)
    updated = GroupDerivedData.objects.filter(
        group_id=group_id,
        version=version,
        cursor__lte=last_id,
    ).update(cursor=last_id, data=new_data)

    if updated:
        derived.cursor = last_id
        derived.data = new_data
        logger.info(
            "issues.derived.processed",
            extra={
                "group_id": group_id,
                "version": version,
                "cursor": last_id,
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
                "our_cursor": last_id,
                "db_cursor": derived.cursor,
            },
        )
        return False


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
