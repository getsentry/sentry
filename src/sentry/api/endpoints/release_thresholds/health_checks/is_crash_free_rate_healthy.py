from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any

from dateutil import parser

from sentry.models.release_threshold.constants import TriggerType

from ..constants import CRASH_USERS_DISPLAY

logger = logging.getLogger("sentry.release_threshold_status.is_crash_free_rate_healthy")

if TYPE_CHECKING:
    from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold


def get_groups_totals(
    sessions_data: dict[str, Any],
    release_version: str,
    project_id: int,
    field: str,
    start_idx: int,
    end_idx: int,
    environment: str | None = None,
    status: str | None = None,
) -> int:
    group_series: list[dict[str, Any]] = [
        g.get("series", {})
        for g in sessions_data.get("groups", [])
        if g.get("by", {}).get("release") == release_version
        and g.get("by", {}).get("project") == project_id
        and (g.get("by", {}).get("environment") == environment if environment else True)
        and (g.get("by", {}).get("session.status") == status if status else True)
    ]
    total = 0
    for group in group_series:
        series = group.get(field, [])
        if len(series) < start_idx or len(series) < end_idx:
            logger.warning(
                "Error calculating session totals",
                extra={"start_idx": start_idx, "end_idx": end_idx, "series_length": len(series)},
            )
            raise IndexError("Start/End indexes are out of range for series")
        total += sum(series[start_idx : end_idx + 1])
    return total


def get_interval_indexes(intervals: list[str], start: datetime, end: datetime) -> tuple[int, int]:
    """
    :param intervals: if timestamps from fetched sessions data
    :param start: timestamp
    :param end: timestamp

    :return: If any subsection of the intervals fall within the given start/end, return the indexes of both the start and the end

    TODO: raise if start/end not contained within intervals?
    """
    start_idx = len(intervals)
    end_idx = 0

    for idx, i in enumerate(intervals):
        interval_date = parser.parse(i).replace(tzinfo=None)
        if start <= interval_date < end:
            if idx < start_idx:
                start_idx = idx
            if end_idx < idx:
                end_idx = idx

    return start_idx, end_idx


def is_crash_free_rate_healthy_check(
    ethreshold: EnrichedThreshold,
    sessions_data: dict[str, Any],
    display: str,
) -> tuple[bool, float]:  # (is_healthy, metric_value)
    """
    Derives percent from crash total over total count

    NOTE: Logic mirrors Frontend views/releases/list/releasesRequest::getCrashFreeRate
    NOTE: if 'environment' not provided, will tally sums for _all_ sessions data as opposed to only sessions with environment of 'None'
    """
    field = "count_unique(user)" if display == CRASH_USERS_DISPLAY else "sum(session)"
    release_version = ethreshold["release"]
    project_id = ethreshold["project_id"]
    environment = ethreshold["environment"]
    intervals = sessions_data.get("intervals", [])
    try:
        start_idx, end_idx = get_interval_indexes(
            intervals=intervals, start=ethreshold["start"], end=ethreshold["end"]
        )
        if start_idx > end_idx:
            logger.warning("Threshold window not within provided session data")
            raise ValueError("Threshold window not within provided session data")
    except ValueError:
        return False, -1

    try:
        crash_count = get_groups_totals(
            end_idx=end_idx,
            environment=environment.get("name") if environment else None,
            field=field,
            project_id=project_id,
            release_version=release_version,
            sessions_data=sessions_data,
            start_idx=start_idx,
            status="crashed",
        )
    except IndexError:
        return False, -1

    try:
        total_count = get_groups_totals(
            end_idx=end_idx,
            environment=environment.get("name") if environment else None,
            field=field,
            project_id=project_id,
            release_version=release_version,
            sessions_data=sessions_data,
            start_idx=start_idx,
        )
    except IndexError:
        return False, -1

    crash_free_percent = (1 - (crash_count / max(total_count, 1))) * 100

    if ethreshold["trigger_type"] == TriggerType.OVER_STR:
        # we're healthy as long as we're under the threshold
        return crash_free_percent < ethreshold["value"], crash_free_percent

    # we're healthy as long as we're over the threshold
    return crash_free_percent > ethreshold["value"], crash_free_percent
