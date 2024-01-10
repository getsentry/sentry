from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, List, Tuple

from sentry.models.release_threshold.constants import TriggerType

from ..constants import CRASH_USERS_DISPLAY

logger = logging.getLogger("sentry.release_threshold_status")

if TYPE_CHECKING:
    from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold


def get_crash_counts(
    sessions_data: Dict[str, Any],
    release_version: str,
    project_id: int,
) -> dict[str, Any]:
    group: dict[str, Any] | None = next(
        x
        for x in sessions_data.get("groups", [])
        if x.get("by", {}).get("release") == release_version
        and x.get("by", {}).get("project") == project_id
        and x.get("by", {}).get("session.status") == "crashed"
    )
    return (group or {}).get("totals", {})


def is_crash_free_rate_healthy(
    ethreshold: EnrichedThreshold,
    sessions_data: Dict[str, Any],
    display: str,
) -> Tuple[bool, int]:  # (is_healthy, metric_value)
    """
    Derives percent from crash total over total count

    NOTE: Logic is pulled from Frontend views/releases/list/releasesRequest::getCrashFreeRate

    Response (is_healthy, metric_value)
    """
    field = "count_unique(user)" if display == CRASH_USERS_DISPLAY else "sum(session)"
    release_version = ethreshold["release"]
    project_id = ethreshold["project_id"]
    crash_counts: dict[str, Any] = get_crash_counts(
        sessions_data=sessions_data,
        release_version=release_version,
        project_id=project_id,
    )
    crashes = crash_counts.get(field, 0)

    totals: List[dict[str, Any]] = list(
        filter(
            lambda x: x.get("by", {}).get("release") == release_version
            and x.get("by", {}).get("project") == project_id,
            sessions_data.get("groups", []),
        )
    )
    total_count = max(sum([t.get("totals", {}).get(field, 0) for t in totals]), 1)

    crash_free_percent = (1 - (crashes / total_count)) * 100

    is_healthy = (
        crash_free_percent
        < ethreshold["value"]  # we're healthy as long as we're under the threshold
        if ethreshold["trigger_type"] == TriggerType.OVER
        else crash_free_percent
        > ethreshold["value"]  # we're healthy as long as we're over the threshold
    )
    return is_healthy, crash_free_percent
