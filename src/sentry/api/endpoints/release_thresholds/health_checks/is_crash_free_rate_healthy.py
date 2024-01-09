from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, Tuple

from sentry.models.release_threshold import TriggerType

from ..constants import CRASH_SESSIONS_DISPLAY, CRASH_USERS_DISPLAY

logger = logging.getLogger("sentry.release_threshold_status")

if TYPE_CHECKING:
    from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold


def get_crash_counts(
    sessions_data: Dict[str, Any],
    release_version: str,
    project_id: int,
) -> int:
    group: dict[str, Any] | None = next(
        x
        for x in sessions_data.get("groups", [])
        if x["release"] == release_version
        and x["project"] == project_id
        and x["session.status"] == "crashed"
    )
    return group.get("totals", {})


def is_crash_free_rate_healthy(
    ethreshold: EnrichedThreshold,
    sessions_data: Dict[str, Any],
    display: CRASH_SESSIONS_DISPLAY | CRASH_USERS_DISPLAY,
) -> Tuple[bool, int]:  # (is_healthy, metric_value)
    """
    Derives percent from crash total over total count

    NOTE: Logic is pulled from Frontend views/releases/list/releasesRequest::getCrashFreeRate

    Response (is_healthy, metric_value)
    """
    field = "count_unique(user)" if display == CRASH_USERS_DISPLAY else "sum(session)"
    crash_counts: dict[str, Any] = get_crash_counts(
        sessions_data=sessions_data,
        release_version=ethreshold.release_version,
        project_id=ethreshold.project.id,
    )
    crashes = crash_counts.get(field, 0)

    totals: dict[str, Any] = filter(
        lambda x: x["release"] == ethreshold.release_version
        and x["project"] == ethreshold.project.id,
        sessions_data.get("groups", []),
    )
    total_count = max(sum([t.get(field, 0) for t in totals]), 1)

    crash_free_percent = (1 - (crashes / total_count)) * 100

    return (
        crash_free_percent > ethreshold.value
        if ethreshold.trigger_type == TriggerType.OVER
        else crash_free_percent < ethreshold.value
    ), crash_free_percent
