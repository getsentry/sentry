import logging
import random
from datetime import datetime, timezone

from django.db.models import Max, Min

from sentry.issues.derived.check import CheckFailure, CheckId, CheckInvalidated, CheckResult
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.utils import metrics

logger = logging.getLogger(__name__)

_MAX_CHECK_GROUPS = 10_000


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
