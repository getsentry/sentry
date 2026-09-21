from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Protocol

from django.db import connections, router
from django.db.models import Max, Min

from sentry.issues.derived.check import CheckFailure, CheckId, CheckInvalidated, CheckResult
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.utils import metrics
from sentry.utils.db import statement_timeout

logger = logging.getLogger(__name__)

_MAX_CHECK_GROUPS = 10_000
_GROUP_ID_RANGE_QUERY_TIMEOUT = timedelta(seconds=40)
# Rows read per density probe, and the number of probes per call. Their product
# bounds the scan; the ratio of scheduled groups to rows read is also exactly how
# far each probe is extrapolated, so these trade query cost against estimate error.
# Sample size fights random gap variance (error falls as 1/sqrt(size), so there is
# little gained past ~100); probe count fights systematic density drift across the
# range, which it shortens linearly. Tune from
# ``issues.derived.heal_range_rows_found`` rather than from first principles.
_RANGE_DENSITY_SAMPLE_SIZE = 100
_MAX_RANGE_DENSITY_SAMPLES = 40


@dataclass(frozen=True)
class GroupIdRangeResult:
    ranges: list[tuple[int, int]]
    drained: bool


class _TaskState(Protocol):
    id: str


class SpawnState:
    """Ergonomic wrapper around self-chain ``already_spawned`` / ``mark_spawned``.

    Construct once from ``current_task()`` and the task's self-chain key. Methods are no-ops when
    there is no activation (eager/sync calls).
    """

    def __init__(self, task_state: _TaskState | None, task_key: str) -> None:
        self.task_key = task_key
        self.activation_id: str | None = task_state.id if task_state is not None else None

    def already_spawned(self) -> bool:
        if self.activation_id is None:
            return False
        return already_spawned(self.task_key, self.activation_id)

    def mark_spawned(self) -> None:
        if self.activation_id is None:
            return
        mark_spawned(self.task_key, self.activation_id)


def _record_check_result(result: CheckResult) -> None:
    outcome = "no_result" if isinstance(result, CheckInvalidated) else "success"
    if isinstance(result, CheckFailure):
        outcome = "mismatch"
        logger.warning(
            "check_derived_data.mismatch",
            extra={
                "group_id": result.group_id,
                "cursor_date": result.cursor_date.isoformat(),
                "cursor_id": result.cursor_id,
                "differences": {
                    feature.name: difference for feature, difference in result.differences.items()
                },
            },
        )
    metrics.incr(
        "issues.derived.check_group",
        sample_rate=1.0,
        tags={"result": outcome},
    )


def _pick_random_fresh_group_ranges(
    pipeline_hash: str, *, batch_size: int, task_count: int
) -> list[tuple[int, int]]:
    """Pick contiguous check ranges from one random anchor (slide-to-fill if short)."""
    if batch_size <= 0 or task_count <= 0:
        return []

    need = min(batch_size * task_count, _MAX_CHECK_GROUPS)
    fresh = GroupDerivedData.objects.filter(pipeline_hash=pipeline_hash)
    bounds = fresh.aggregate(min_group_id=Min("group_id"), max_group_id=Max("group_id"))
    min_group_id = bounds["min_group_id"]
    max_group_id = bounds["max_group_id"]
    if min_group_id is None or max_group_id is None:
        return []

    random_start = random.randint(min_group_id, max_group_id)
    group_ids = list(
        fresh.filter(group_id__gte=random_start)
        .order_by("group_id")
        .values_list("group_id", flat=True)[:need]
    )
    if len(group_ids) < need:
        # Short forward tail: take the last ``need`` fresh rows (one contiguous band).
        group_ids = list(fresh.order_by("-group_id").values_list("group_id", flat=True)[:need])
        group_ids.reverse()
    if not group_ids:
        return []

    ranges: list[tuple[int, int]] = []
    for i in range(0, len(group_ids), batch_size):
        chunk = group_ids[i : i + batch_size]
        ranges.append((chunk[0], chunk[-1] + 1))
    return ranges


def group_id_ranges_for_hash(
    pipeline_hash: str | None, *, chunk_size: int, max_chunks: int, group_id_lower_bound: int = 0
) -> GroupIdRangeResult:
    """Estimate ranges covering GroupDerivedData rows with a pipeline_hash.

    Returns at most max_chunks of ascending disjoint [start, end) ranges, each
    targeting chunk_size group IDs. Density is sampled at a bounded number of
    points so the query cost stays flat as the scheduling budget grows, which
    makes the per-region throughput knob independent of how long this runs.
    Ranges are therefore approximate: an over-dense one is split by the worker,
    and an under-dense one costs only a scheduling slot. ``drained`` is true
    only when a valid query found no rows at or above ``group_id_lower_bound``.

    Raises ``OperationalError`` if all density probes together exceed the server-side
    statement timeout. Callers must not interpret that as a drained hash.
    """
    if chunk_size <= 0 or max_chunks <= 0:
        return GroupIdRangeResult(ranges=[], drained=False)

    hash_predicate = "pipeline_hash IS NULL" if pipeline_hash is None else "pipeline_hash = %s"
    sql = f"""
        SELECT group_id
        FROM {GroupDerivedData._meta.db_table}
        WHERE {hash_predicate} AND group_id >= %s
        ORDER BY pipeline_hash, group_id
        LIMIT %s
    """

    using = router.db_for_read(GroupDerivedData)
    ranges: list[tuple[int, int]] = []
    next_group_id = group_id_lower_bound
    sample_limit = _RANGE_DENSITY_SAMPLE_SIZE + 1
    sample_count = min(max_chunks, _MAX_RANGE_DENSITY_SAMPLES)

    with (
        metrics.timer("issues.derived.group_id_range_query"),
        statement_timeout(using, _GROUP_ID_RANGE_QUERY_TIMEOUT),
        connections[using].cursor() as db_cursor,
    ):
        while len(ranges) < max_chunks:
            params: list[str | int] = [] if pipeline_hash is None else [pipeline_hash]
            params += [next_group_id, sample_limit]
            db_cursor.execute(sql, params)
            sampled_group_ids = [row[0] for row in db_cursor.fetchall()]

            if not sampled_group_ids:
                return GroupIdRangeResult(ranges=ranges, drained=not ranges)

            if len(sampled_group_ids) <= _RANGE_DENSITY_SAMPLE_SIZE:
                starts = sampled_group_ids[::chunk_size]
                ends = starts[1:] + [sampled_group_ids[-1] + 1]
                ranges.extend(zip(starts, ends))
                break

            density_sample = sampled_group_ids[:_RANGE_DENSITY_SAMPLE_SIZE]
            sample_width = density_sample[-1] - density_sample[0] + 1
            estimated_chunk_width = max(
                1,
                ceil(sample_width * chunk_size / len(density_sample)),
            )
            samples_left = min(sample_count, max_chunks - len(ranges))
            chunks_for_sample = ceil((max_chunks - len(ranges)) / samples_left)

            range_start = density_sample[0]
            for _ in range(chunks_for_sample):
                range_end = range_start + estimated_chunk_width
                ranges.append((range_start, range_end))
                range_start = range_end
            next_group_id = range_start
            sample_count -= 1

    return GroupIdRangeResult(ranges=ranges[:max_chunks], drained=False)


def _resume_check_id(
    group_id: int,
    invocation_id: str | None,
    generated_at: str | None,
    cursor_date: str | None,
    cursor_id: int | None,
    pipeline_hash: str | None,
) -> CheckId | None:
    if None in (invocation_id, generated_at, cursor_date, cursor_id, pipeline_hash):
        return None
    assert invocation_id is not None
    assert generated_at is not None
    assert cursor_date is not None
    assert cursor_id is not None
    assert pipeline_hash is not None
    return CheckId(
        invocation_id,
        group_id,
        datetime.fromisoformat(generated_at).replace(tzinfo=timezone.utc),
        datetime.fromisoformat(cursor_date).replace(tzinfo=timezone.utc),
        cursor_id,
        pipeline_hash,
    )
