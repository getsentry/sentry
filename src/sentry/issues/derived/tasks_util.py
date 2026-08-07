import logging
import random
from datetime import datetime, timezone

from django.db.models import Max, Min

from sentry.issues.derived.check import CheckFailure, CheckId, CheckResult
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.utils import metrics

logger = logging.getLogger(__name__)

_MAX_CHECK_GROUPS = 10_000


def _record_check_result(result: CheckResult | None) -> None:
    outcome = "no_result" if result is None else "success"
    if isinstance(result, CheckFailure):
        outcome = "mismatch"
        logger.warning(
            "check_group_derived_data.mismatch",
            extra={
                "group_id": result.group_id,
                "cursor_date": result.cursor_date.isoformat(),
                "cursor_id": result.cursor_id,
                "features": sorted(result.features),
            },
        )
    metrics.incr(
        "issues.derived.check_group",
        sample_rate=1.0,
        tags={"result": outcome},
    )


def _pick_random_fresh_group_range(pipeline_hash: str, target_size: int) -> tuple[int, int] | None:
    """Pick a random range containing up to ``target_size`` fresh rows."""
    target_size = min(target_size, _MAX_CHECK_GROUPS)
    if target_size <= 0:
        return None

    fresh = GroupDerivedData.objects.filter(pipeline_hash=pipeline_hash)
    bounds = fresh.aggregate(min_group_id=Min("group_id"), max_group_id=Max("group_id"))
    min_group_id = bounds["min_group_id"]
    max_group_id = bounds["max_group_id"]
    if min_group_id is None or max_group_id is None:
        return None

    random_start = random.randint(min_group_id, max_group_id)
    group_ids = list(
        fresh.filter(group_id__gte=random_start)
        .order_by("group_id")
        .values_list("group_id", flat=True)[:target_size]
    )
    if not group_ids:
        return None
    return group_ids[0], group_ids[-1] + 1


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
