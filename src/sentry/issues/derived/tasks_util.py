from __future__ import annotations

import logging
import random
import time
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Protocol

from django.db.models import Max, Min
from django.db.utils import OperationalError

from sentry.issues.derived.check import CheckFailure, CheckId, CheckInvalidated, CheckResult
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.utils import metrics
from sentry.utils.db import statement_timeout

logger = logging.getLogger(__name__)

_MAX_CHECK_GROUPS = 10_000
_GROUP_ID_RANGE_QUERY_TIMEOUT = timedelta(seconds=40)
# Use exact boundaries below this requested row count; estimate density above it.
_MAX_EXACT_RANGE_ROWS = 10_000
# Each probe reads this many matching IDs and extrapolates the following number of ranges.
_RANGE_DENSITY_SAMPLE_SIZE = 100
_RANGES_PER_DENSITY_SAMPLE = 5
# Bound total probe work for regions with large scheduling budgets.
_MAX_RANGE_DENSITY_SAMPLES = 200


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


def _exact_group_id_ranges(
    group_ids: Sequence[int], *, range_size: int, max_ranges: int
) -> list[tuple[int, int]]:
    """Build exact ranges from ordered IDs, using an optional lookahead ID as the final end."""
    if not group_ids:
        return []

    requested_rows = range_size * max_ranges
    starts = group_ids[:requested_rows:range_size]
    last_end = group_ids[requested_rows] if len(group_ids) > requested_rows else group_ids[-1] + 1
    return list(zip(starts, [*starts[1:], last_end]))


def _estimate_group_id_ranges(
    density_sample: Sequence[int], *, range_size: int, range_count: int
) -> list[tuple[int, int]]:
    """Build contiguous ranges sized from the density of an ordered ID sample."""
    sample_width = density_sample[-1] - density_sample[0] + 1
    estimated_width = ceil(sample_width * range_size / len(density_sample))
    first_group_id = density_sample[0]
    return [
        (
            first_group_id + index * estimated_width,
            first_group_id + (index + 1) * estimated_width,
        )
        for index in range(range_count)
    ]


def group_id_ranges_for_hash(
    pipeline_hash: str | None, *, range_size: int, max_ranges: int, group_id_lower_bound: int = 0
) -> GroupIdRangeResult:
    """Estimate ranges covering GroupDerivedData rows with a pipeline_hash.

    Returns at most max_ranges of ascending disjoint [start, end) ranges, each
    targeting range_size group IDs. ``drained`` is true only when a valid query
    found no rows at or above ``group_id_lower_bound``.

    Imagine a sequence of GroupDerivedData rows with some stale (s):

        s.......s.......s.......s...........ssssssss....
        0       8       16      24          36..43

    We can precisely query for ranges with an equal number of stale rows, but that requires
    us to do a full index scan of those rows, and if we've been mutating, that can get
    surprisingly slow, especially since we'd like to be able to divvy out 100s of thousands
    of rows. Our range processing task also filters and is tolerant of variation, so instead
    of trying to be exact, we approximate.

    Simply cutting the ID span into N equal ranges can be rough. Asking for 3 above gives
    [0,16) [16,32) [32,48), holding 2, 2, and 8 stale rows: one range has two thirds of the
    work, and that's bad for our goal of great throughput.

    Instead, we set a budget of how much we'd like to do, and take incremental 'core samples',
    using each to size the ranges that follow it. Sampling 4 rows at a time and targeting 4
    rows per range, the first sample reads 0, 8, 16, 24, four rows spanning 25 IDs, so we emit
    [0,25). The next sample resumes there, skips the empty gap entirely, and lands on
    36, 37, 38, 39, four rows spanning 4 IDs, so we emit [36,40). The last sample sees the end
    of the data and falls back to exact boundaries, [40,44).

    That's 4, 4, 4 instead of 2, 2, 8, for 3 small queries instead of a full scan. It's still
    an estimate: an over-dense range is split by the worker, an under-dense one costs only a
    scheduling slot. In production a sample is _RANGE_DENSITY_SAMPLE_SIZE rows and sizes
    _RANGES_PER_DENSITY_SAMPLE ranges, rather than one.

    Raises ``OperationalError`` if all density probes together exceed the query
    budget. Callers must not interpret that as a drained hash.
    """
    if range_size <= 0 or max_ranges <= 0:
        return GroupIdRangeResult(ranges=[], drained=False)

    matching_group_ids = (
        GroupDerivedData.objects.filter(pipeline_hash=pipeline_hash)
        .order_by("pipeline_hash", "group_id")
        .values_list("group_id", flat=True)
    )
    using = matching_group_ids.db
    matching_group_ids = matching_group_ids.using(using)
    query_deadline = time.monotonic() + _GROUP_ID_RANGE_QUERY_TIMEOUT.total_seconds()

    with metrics.timer("issues.derived.group_id_range_query"):

        def fetch_group_ids(start: int, limit: int) -> list[int]:
            remaining_seconds = query_deadline - time.monotonic()
            if remaining_seconds <= 0.001:
                raise OperationalError("group ID range query budget exceeded")

            with statement_timeout(using, timedelta(seconds=remaining_seconds)):
                return list(matching_group_ids.filter(group_id__gte=start)[:limit])

        requested_rows = range_size * max_ranges
        if requested_rows <= _MAX_EXACT_RANGE_ROWS:
            group_ids = fetch_group_ids(group_id_lower_bound, requested_rows + 1)
            if not group_ids:
                return GroupIdRangeResult(ranges=[], drained=True)

            return GroupIdRangeResult(
                ranges=_exact_group_id_ranges(
                    group_ids,
                    range_size=range_size,
                    max_ranges=max_ranges,
                ),
                drained=False,
            )

        result_ranges: list[tuple[int, int]] = []
        next_group_id = group_id_lower_bound
        density_sample_count = min(
            ceil(max_ranges / _RANGES_PER_DENSITY_SAMPLE),
            _MAX_RANGE_DENSITY_SAMPLES,
        )
        ranges_per_sample, samples_with_extra_range = divmod(max_ranges, density_sample_count)
        # Ranges probably don't divide equally by samples, so we try to distribute the remainder
        # cleanly.
        range_counts = [ranges_per_sample + 1] * samples_with_extra_range + [ranges_per_sample] * (
            density_sample_count - samples_with_extra_range
        )

        for ranges_for_sample in range_counts:
            sampled_group_ids = fetch_group_ids(next_group_id, _RANGE_DENSITY_SAMPLE_SIZE + 1)
            if not sampled_group_ids:
                return GroupIdRangeResult(ranges=result_ranges, drained=not result_ranges)
            if len(sampled_group_ids) <= _RANGE_DENSITY_SAMPLE_SIZE:
                # We requested one extra, so this means we've got all the data and can exit.
                starts = sampled_group_ids[::range_size]
                ends = starts[1:] + [sampled_group_ids[-1] + 1]
                result_ranges.extend(zip(starts, ends))
                break

            # trim the over-query
            density_sample = sampled_group_ids[:-1]
            # generate range_for_sample ranges based on density_sample.
            estimated_ranges = _estimate_group_id_ranges(
                density_sample,
                range_size=range_size,
                range_count=ranges_for_sample,
            )
            result_ranges.extend(estimated_ranges)
            next_group_id = estimated_ranges[-1][1]

    return GroupIdRangeResult(ranges=result_ranges[:max_ranges], drained=False)


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
