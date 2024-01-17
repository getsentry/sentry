from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Tuple

logger = logging.getLogger("sentry.release_threshold_status.is_new_issues_count_healthy")

if TYPE_CHECKING:
    from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold


def is_new_issue_count_healthy(ethreshold: EnrichedThreshold, new_issue_groups) -> Tuple[bool, int]:
    return False, 0
