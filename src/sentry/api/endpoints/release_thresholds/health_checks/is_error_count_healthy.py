from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from dateutil import parser

from sentry.models.release_threshold.constants import TriggerType
from sentry.utils import metrics

logger = logging.getLogger("sentry.release_threshold_status.is_error_count_healthy")

if TYPE_CHECKING:
    from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold


def is_error_count_healthy(
    ethreshold: EnrichedThreshold, timeseries: list[dict[str, Any]]
) -> tuple[bool, int]:
    """
    Iterate through timeseries given threshold window and determine health status
    enriched threshold (ethreshold) includes `start`, `end`, and a constructed `key` identifier
    """
    total_count = 0
    threshold_environment: str | None = (
        ethreshold["environment"]["name"] if ethreshold["environment"] else None
    )
    sorted_series = sorted(timeseries, key=lambda x: x["time"])
    for i in sorted_series:
        if parser.parse(i["time"]) > ethreshold["end"]:
            # timeseries are ordered chronologically
            # So if we're past our threshold.end, we can skip the rest
            logger.info("Reached end of threshold window. Breaking")
            metrics.incr("release.threshold_health_status.is_error_count_healthy.break_loop")
            break
        if (
            parser.parse(i["time"]) <= ethreshold["start"]  # ts is before our threshold start
            or parser.parse(i["time"]) > ethreshold["end"]  # ts is after our threshold end
            or i["release"] != ethreshold["release"]  # ts is not our the right release
            or i["project_id"] != ethreshold["project_id"]  # ts is not the right project
            or i["environment"] != threshold_environment  # ts is not the right environment
        ):
            metrics.incr("release.threshold_health_status.is_error_count_healthy.skip")
            continue
        # else ethreshold.start < i.time <= ethreshold.end
        metrics.incr("release.threshold_health_status.is_error_count_healthy.aggregate_total")
        total_count += i["count()"]

    logger.info(
        "check",
        extra={
            "threshold": ethreshold,
            "total_count": total_count,
            "error_count_data": timeseries,
            "threshold_environment": threshold_environment,
        },
    )

    if ethreshold["trigger_type"] == TriggerType.OVER_STR:
        # If total is under/equal the threshold value, then it is healthy
        return total_count <= ethreshold["value"], total_count

    # Else, if total is over/equal the threshold value, then it is healthy
    return total_count >= ethreshold["value"], total_count
