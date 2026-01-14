from __future__ import annotations

from dataclasses import dataclass

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel


@dataclass(frozen=True)
class InstrumentationIssueExperimentalGroupType(GroupType):
    """
    Issues detected by autopilot instrumentation analysis suggesting
    improvements to product usage and observability coverage.
    """

    type_id = 12001
    slug = "instrumentation_issue_experimental"
    description = "Instrumentation Issue"
    category = GroupCategory.INSTRUMENTATION.value
    category_v2 = GroupCategory.INSTRUMENTATION.value
    creation_quota = Quota(3600, 60, 100)  # 100 per hour, sliding window of 60 seconds
    default_priority = PriorityLevel.LOW
    in_default_search = False  # Hide from issues stream
    released = False  # Start as feature-flagged
    enable_auto_resolve = False
    enable_escalation_detection = False
