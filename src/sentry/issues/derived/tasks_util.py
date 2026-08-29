import logging
import random
from datetime import datetime, timezone

from django.db import connections, router
from django.db.models import Max, Min

from sentry.issues.derived.check import CheckFailure, CheckId, CheckInvalidated, CheckResult
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.utils import metrics

logger = logging.getLogger(__name__)

_MAX_CHECK_GROUPS = 10_000

# Safety valve on the number of group IDs one ``group_id_ranges_for_hash`` call may
# walk, however large the requested chunking is.
_MAX_SCANNED_GROUP_IDS = 2_000_000


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
    pipeline_hash: str | None, *, chunk_size: int, max_chunks: int
) -> list[tuple[int, int]]:
    """Partition the group IDs of GroupDerivedData rows with a pipeline_hash into ranges.

    Returns at most max_chunks of ascending disjoint [start, end) ranges, each
    covering chunk_size group IDs but possibly the last.
    """
    if chunk_size <= 0 or max_chunks <= 0:
        return []

    # One boundary per chunk, plus one extra to close the final range (or, if we ran
    # out of matching rows first, to tell us we did).
    scan_limit = chunk_size * (max_chunks + 1)
    if scan_limit > _MAX_SCANNED_GROUP_IDS:
        logger.warning(
            "group_id_ranges_for_hash.scan_budget_clamped",
            extra={
                "chunk_size": chunk_size,
                "max_chunks": max_chunks,
                "requested_scan_limit": scan_limit,
                "max_scan_limit": _MAX_SCANNED_GROUP_IDS,
            },
        )
        # Never clamp below two chunks: a lone boundary can't close a range, so we'd
        # return nothing and the caller would take that to mean there was nothing to do.
        scan_limit = max(_MAX_SCANNED_GROUP_IDS, chunk_size * 2)

    hash_predicate = "pipeline_hash IS NULL" if pipeline_hash is None else "pipeline_hash = %s"
    # The LIMIT lives in the innermost subquery to encourage Postgres to enforce
    # the limit before doing the window function stuff. ``cnt`` tells us whether we
    # hit the limit, and pulls out the last row we saw so we can close the final
    # chunk without a second query.
    sql = f"""
        SELECT group_id, rn, cnt FROM (
            SELECT group_id,
                   -- Ordered so the numbering is defined rather than dependent on the
                   -- order the subquery happens to emit. count(*) stays unordered; an
                   -- ORDER BY there would turn it into a running count.
                   row_number() OVER (ORDER BY group_id) - 1 AS rn,
                   count(*) OVER () AS cnt
            FROM (
                SELECT group_id
                FROM {GroupDerivedData._meta.db_table}
                WHERE {hash_predicate}
                ORDER BY group_id
                LIMIT %s
            ) scanned
        ) numbered
        WHERE mod(rn, %s) = 0 OR rn = cnt - 1
        ORDER BY rn
    """
    params: list[str | int] = [] if pipeline_hash is None else [pipeline_hash]
    params += [scan_limit, chunk_size]

    using = router.db_for_read(GroupDerivedData)
    with (
        metrics.timer("issues.derived.group_id_range_query"),
        connections[using].cursor() as cursor,
    ):
        cursor.execute(sql, params)
        rows = cursor.fetchall()

    if not rows:
        return []

    scanned = rows[0][2]
    boundaries = [group_id for group_id, rn, _ in rows if rn % chunk_size == 0]

    if scanned == scan_limit:
        # We got more than enough rows; the trailing boundary closes the last range.
        ends = boundaries[1:]
    else:
        # We didn't fill out the final chunk, so the last row we scanned closes it.
        ends = boundaries[1:] + [rows[-1][0] + 1]
    return list(zip(boundaries, ends))[:max_chunks]


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
