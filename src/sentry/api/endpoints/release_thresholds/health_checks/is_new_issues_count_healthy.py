from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from sentry.models.release_threshold.constants import TriggerType

logger = logging.getLogger("sentry.release_threshold_status.is_new_issues_count_healthy")

if TYPE_CHECKING:
    from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold


def is_new_issue_count_healthy(
    ethreshold: EnrichedThreshold, new_issue_counts: dict[str, Any]
) -> tuple[bool, int]:
    new_issue_count = new_issue_counts.get(str(ethreshold["id"]), 0)
    if ethreshold["trigger_type"] == TriggerType.OVER_STR:
        # If total is under/equal the threshold value, then it is healthy
        return new_issue_count <= ethreshold["value"], new_issue_count

    # Else, if total is over/equal the threshold value, then it is healthy
    return new_issue_count >= ethreshold["value"], new_issue_count
