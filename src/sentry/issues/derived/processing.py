from __future__ import annotations

import enum
import logging
import time
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import NamedTuple

from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils import timezone

from sentry.db.postgres.transactions import enforce_constraints
from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.framework import Pipeline, State
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.derived.tasks import generate_group_derived_data, process_group_log_task
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import EPOCH, GroupDerivedData
from sentry.models.group import Group
from sentry.utils import metrics

logger = logging.getLogger(__name__)

PIPELINE: Pipeline[GroupActionLogEntry] = Pipeline(AGGREGATORS)

DEFAULT_BATCH_SIZE = 1000
INLINE_BATCH_SIZE = 100
_VERY_STALE_ENTRY_AGE_THRESHOLD_SECONDS = timedelta(hours=2).total_seconds()


class GenerationId(NamedTuple):
    """Uniquely identifies a generation attempt for a group."""

    group_id: int
    generated_at: datetime  # when this generation started; reflects log state observed
    pipeline_hash: str


class ProcessingStrategy(enum.Enum):
    SYNC = "sync"  # process all pending actions now
    ASYNC = "async"  # schedule a task to process all pending actions
    INLINE = "inline"  # try to process all pending actions quickly; fall back to ASYNC


@dataclass(frozen=True)
class DerivedMetrics:
    """Encapsulates derived-data metric reporting; incremental mode adds per-entry latency."""

    mode: ProcessingStrategy
    incremental: bool

    def as_not_incremental(self) -> DerivedMetrics:
        """Disable incremental-only metrics.

        An incremental path can discover in context that the row requires initial or replay processing.
        """
        if not self.incremental:
            return self
        return DerivedMetrics(mode=self.mode, incremental=False)

    def report_batch_processed(
        self,
        entries: Sequence[GroupActionLogEntry],
        result: State,
    ) -> None:
        if self.incremental:
            now = timezone.now()
            tags = {"mode": self.mode.value}
            for entry in entries:
                age_seconds = (now - entry.date_added).total_seconds()
                if age_seconds > _VERY_STALE_ENTRY_AGE_THRESHOLD_SECONDS:
                    logger.info(
                        "issues.derived.incremental_processing_very_stale",
                        extra={
                            "group_id": entry.group_id,
                            "log_entry_id": entry.id,
                            "age_seconds": age_seconds,
                        },
                    )
                metrics.distribution(
                    "issues.derived.incremental_processing_latency",
                    age_seconds,
                    tags=tags,
                    unit="second",
                )
        for f in result.updated:
            metrics.incr(
                "issues.derived.feature_updated",
                sample_rate=1.0,
                tags={"feature": f.name},
            )


def _ensure_derived(group_id: int, pipeline_hash: str) -> tuple[GroupDerivedData, bool]:
    """Get or create the GroupDerivedData row for a group.

    Returns the row and whether processing from it is expected to be incremental
    based on row existence and pipeline hash. This is best-effort: a concurrently
    initialized row may still have historical entries left to process.
    Raises Group.DoesNotExist if the group has been deleted.
    """
    try:
        derived = GroupDerivedData.objects.get(group_id=group_id)
        return derived, derived.pipeline_hash == pipeline_hash
    except GroupDerivedData.DoesNotExist:
        pass

    try:
        # Contain a possible database error so an enclosing transaction remains usable.
        with enforce_constraints(transaction.atomic(using=router.db_for_write(GroupDerivedData))):
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
        # get_or_create() retries get() after an IntegrityError and suppresses the
        # error when a concurrent insert created the row. An error escaping it is
        # therefore not the group_id uniqueness race, but another constraint. With
        # this model's current constraints, that is a missing Group foreign key.
        raise Group.DoesNotExist(f"Group {group_id} does not exist")
    return derived, False


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
    derived_metrics: DerivedMetrics | None = None,
) -> bool:
    """
    Process up to `batch_size` entries for a group. Updates derived in place.
    Returns True if there are more entries to process.

    Concurrency: multiple callers may process the same group simultaneously.
    Safety relies on two properties:

    1. The action log is append-only and the pipeline is deterministic, so
       any caller processing the same entries produces the same result.
    2. The UPDATE uses a cursor guard that only succeeds if no
       other caller has already advanced the cursor past our batch. If it
       fails (updated == 0), a concurrent caller already wrote a superset
       of our work, so we refresh and check if more remains.

    This is an optimistic concurrency scheme — no locks are held, and the
    last-writer-wins semantics are safe because all writers compute the
    same deterministic result for overlapping entry ranges.

    Invalidated rows (null pipeline_hash) are treated as compatible with
    any writer's hash: the row is known to be out of date and awaiting
    replacement, but there's no reason to freeze incremental progress in
    the meantime.

    When *persist* is False, only the in-memory object is updated — the
    caller is responsible for persisting the result (e.g. via
    ``promote_to_live``). Used for full generations that accumulate
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
        Q(id=derived.id, generated_at=derived.generated_at)
        & (Q(cursor_date__lt=last_date) | Q(cursor_date=last_date, cursor_id__lte=last_id))
        & (Q(pipeline_hash=derived.pipeline_hash) | Q(pipeline_hash__isnull=True))
    ).update(cursor_date=last_date, cursor_id=last_id, **state_update)

    if updated:
        if derived_metrics is not None:
            derived_metrics.report_batch_processed(entries, result)
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

    def __init__(self, group_id: int, generation_id: GenerationId | None = None) -> None:
        self.group_id = group_id
        self.generation_id = generation_id
        super().__init__(group_id)


def _drain_log(
    derived: GroupDerivedData,
    pipeline: Pipeline[GroupActionLogEntry],
    batch_size: int = DEFAULT_BATCH_SIZE,
    *,
    time_limit: timedelta,
    persist: bool = True,
    derived_metrics: DerivedMetrics | None = None,
) -> bool:
    """Process pending log entries into *derived*, batching as needed.

    Returns True if all entries were processed, False if the time limit was
    reached and more entries remain. The limit is checked between batches,
    so a single slow batch can exceed it.

    When *persist* is False, batches update only the in-memory object.
    """
    deadline = time.monotonic() + time_limit.total_seconds()
    while _process_batch(
        pipeline, derived, batch_size, persist=persist, derived_metrics=derived_metrics
    ):
        if time.monotonic() >= deadline:
            return False
    return True


# ---------------------------------------------------------------------------
# Incremental processing (on event arrival)
# ---------------------------------------------------------------------------


def process_group_log(
    group_id: int,
    batch_size: int = DEFAULT_BATCH_SIZE,
    pipeline: Pipeline[GroupActionLogEntry] | None = None,
    timeout: timedelta | None = None,
    derived_metrics: DerivedMetrics | None = None,
) -> GroupDerivedData:
    """Fully drain all pending entries for a group's row.

    Raises Group.DoesNotExist if the group has been deleted.
    Raises GroupLogTimeout if *timeout* elapses before all
    entries are processed.
    """
    p = pipeline or PIPELINE

    derived, expected_incremental = _ensure_derived(group_id, p.pipeline_hash)
    if derived_metrics is not None and not expected_incremental:
        derived_metrics = derived_metrics.as_not_incremental()

    if timeout is not None:
        drained = _drain_log(
            derived, p, batch_size, time_limit=timeout, derived_metrics=derived_metrics
        )
        if not drained:
            raise GroupLogTimeout(group_id)
    else:
        # No timeout — drain to completion.
        while _process_batch(p, derived, batch_size, derived_metrics=derived_metrics):
            pass

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
        process_group_log_task.delay(group_id, incremental=True)
        return

    if strategy is ProcessingStrategy.SYNC:
        try:
            process_group_log(
                group_id,
                derived_metrics=DerivedMetrics(mode=strategy, incremental=True),
            )
        except ObjectDoesNotExist:
            pass
        return

    assert strategy is ProcessingStrategy.INLINE

    pipeline = PIPELINE

    with metrics.timer("issues.derived.inline_processing"):
        try:
            derived, expected_incremental = _ensure_derived(group_id, pipeline.pipeline_hash)
        except ObjectDoesNotExist:
            return

        has_more = _process_batch(
            pipeline,
            derived,
            INLINE_BATCH_SIZE,
            derived_metrics=DerivedMetrics(
                mode=strategy,
                incremental=expected_incremental,
            ),
        )
    if has_more:
        # Derived data will be stale for any code running between now and
        # when the task completes.
        metrics.incr("issues.derived.inline_fallback_to_async")
        process_group_log_task.delay(group_id, incremental=expected_incremental)


# ---------------------------------------------------------------------------
# Invalidation
# ---------------------------------------------------------------------------


def invalidate_group_derived_data(
    group_id: int,
    cursor: tuple[datetime, int] | None = None,
    soft: bool = True,
    trigger_regenerate: bool = True,
) -> None:
    """Mark a group's derived data as out-of-date with respect to its action log.

    *cursor* is ``(date_added, id)`` of the earliest affected entry. If the
    row's cursor is behind that point the mutation is a pure append and the
    row is left alone — an incremental drain will catch it up.

    Otherwise: ``soft=True`` (default) nulls ``pipeline_hash`` and bumps
    ``generated_at`` — the row stays readable but flagged stale, and any
    in-flight generation started before this call loses its promotion CAS.
    ``soft=False`` deletes the row so readers cannot observe pre-mutation
    state.

    Under ``soft=True`` with no existing row, one is inserted with
    ``pipeline_hash=None`` as an explicit "needs regen" marker for bulk
    healing (uniform with already-stale rows).

    If *trigger_regenerate* is True (default), schedules a follow-up task.
    Bulk callers driving their own regeneration should pass False.
    """
    if cursor is None:
        invalid_predicate = Q(group_id=group_id)
    else:
        cursor_date, cursor_id = cursor
        # Null-hash rows are matched unconditionally: they're already stale
        # so there's no up-to-date state to protect, and refreshing their
        # ``generated_at`` forces any in-flight generation started before
        # this call to lose its promotion CAS (see below).
        invalid_predicate = Q(group_id=group_id) & (
            Q(pipeline_hash__isnull=True)
            | Q(cursor_date__gt=cursor_date)
            | Q(cursor_date=cursor_date, cursor_id__gte=cursor_id)
        )

    # Combine the guard with the write so a concurrent promotion past our
    # cursor isn't clobbered.
    qs = GroupDerivedData.objects.filter(invalid_predicate)
    if soft:
        # Bumping ``generated_at`` reuses ``promote_to_live``'s SUPERSEDED
        # CAS path — pre-invalidation snapshots can't win over the null-hash
        # row.
        affected = qs.update(pipeline_hash=None, generated_at=timezone.now())
    else:
        affected, _ = qs.delete()

    if not affected:
        # Either no row exists yet, or an existing row's cursor is already
        # past the affected point (pure append). Under soft=True with no
        # row, insert a null-hash placeholder so bulk healing sees a
        # uniform "needs regen" signal.
        row_exists = GroupDerivedData.objects.filter(group_id=group_id).exists()
        if soft and not row_exists:
            # Race-safe: if a concurrent writer inserted a live row first,
            # get_or_create is a no-op and we fall through to pure-append.
            # If the group itself was deleted since the existence check, the
            # insert fails — treat as a no-op.
            try:
                _, created = GroupDerivedData.objects.get_or_create(
                    group_id=group_id, defaults={"pipeline_hash": None}
                )
            except IntegrityError:
                logger.info(
                    "issues.derived.invalidate.group_missing",
                    extra={"group_id": group_id},
                )
                return
            if created:
                logger.info(
                    "issues.derived.invalidated",
                    extra={
                        "group_id": group_id,
                        "cursor_date": str(cursor[0]) if cursor else None,
                        "cursor_id": cursor[1] if cursor else None,
                        "soft": True,
                        "trigger_regenerate": trigger_regenerate,
                        "inserted": True,
                    },
                )
                if trigger_regenerate:
                    generate_group_derived_data.delay(group_id)
                return

        # Pure append (or nothing to delete): a normal drain suffices.
        if trigger_regenerate:
            process_group_log_task.delay(group_id)
        return

    logger.info(
        "issues.derived.invalidated",
        extra={
            "group_id": group_id,
            "cursor_date": str(cursor[0]) if cursor else None,
            "cursor_id": cursor[1] if cursor else None,
            "soft": soft,
            "trigger_regenerate": trigger_regenerate,
        },
    )

    if trigger_regenerate:
        generate_group_derived_data.delay(group_id)
