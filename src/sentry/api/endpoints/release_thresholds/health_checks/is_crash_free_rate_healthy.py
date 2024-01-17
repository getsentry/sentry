from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Tuple

from dateutil import parser

from sentry.models.release_threshold.constants import TriggerType

from ..constants import CRASH_USERS_DISPLAY

logger = logging.getLogger("sentry.release_threshold_status")

if TYPE_CHECKING:
    from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold


def get_groups_totals(
    sessions_data: Dict[str, Any],
    release_version: str,
    project_id: int,
    field: str,
    start_idx: int,
    end_idx: int,
    environment: str | None,
    status: str | None,
) -> int:
    filters = ["release", "project"]
    if environment:
        filters.append("environment")
    if status:
        filters.append("session.status")
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
            raise IndexError("Start/End indexes are out of range for series")
        total += sum(series[start_idx : end_idx + 1])
    return total


def get_interval_indexes(intervals: list[str], start: datetime, end: datetime) -> Tuple[int, int]:
    """
    :param intervals: if timestamps from fetched sessions data
    :param start: timestamp
    :param end: timestamp

    :return: If any subsection of the intervals fall within the given start/end, return the indexes of both the start and the end

    TODO: raise if start/end not contained within intervals?
    """
    start_idx = len(intervals)
    end_idx = 0

    for i, idx in enumerate(intervals):
        interval_date = parser.parse(i).replace(tzinfo=None)
        if start <= interval_date < end:
            if idx < start_idx:
                start_idx = idx
            if end_idx < idx:
                end_idx = idx

    return start_idx, end_idx


def is_crash_free_rate_healthy(
    ethreshold: EnrichedThreshold,
    sessions_data: Dict[str, Any],
    display: str,
) -> Tuple[bool, int]:  # (is_healthy, metric_value)
    """
    Derives percent from crash total over total count

    NOTE: Logic mirrors Frontend views/releases/list/releasesRequest::getCrashFreeRate
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
            raise ValueError("")
    except ValueError:
        # TODO: determine how to handle threshold range not within fetched intervals
        pass

    try:
        crash_count = get_groups_totals(
            end_idx=end_idx,
            environment=environment,
            field=field,
            project_id=project_id,
            release_version=release_version,
            sessions_data=sessions_data,
            start_idx=start_idx,
            status="crashed",
        )
    except IndexError:
        # TODO: determine how to handle threshold range not within fetched intervals
        pass

    try:
        total_count = get_groups_totals(
            end_idx=end_idx,
            environment=environment,
            field=field,
            project_id=project_id,
            release_version=release_version,
            sessions_data=sessions_data,
            start_idx=start_idx,
        )
    except IndexError:
        # TODO: determine how to handle threshold range not within fetched intervals
        pass

    crash_free_percent = (1 - (crash_count / total_count)) * 100

    if ethreshold["trigger_type"] == TriggerType.OVER_STR:
        # we're healthy as long as we're under the threshold
        return crash_free_percent < ethreshold["value"], crash_free_percent

    # we're healthy as long as we're over the threshold
    return crash_free_percent > ethreshold["value"], crash_free_percent
