from __future__ import annotations

from dataclasses import dataclass

from sentry_redis_tools.sliding_windows_rate_limiter import Quota

from sentry.issues.grouptype import GroupCategory, GroupType, NotificationConfig
from sentry.monitors.types import GROUP_TYPE_MONITOR_CHECK_IN_FAILURE

# Imported so the validator registers itself for this group type.
from sentry.monitors.validators import MonitorIncidentDetectorValidator  # noqa: F401
from sentry.types.group import PriorityLevel


@dataclass(frozen=True)
class MonitorIncidentType(GroupType):
    type_id = 4001
    slug = GROUP_TYPE_MONITOR_CHECK_IN_FAILURE
    description = "Crons Monitor Failed"
    category = GroupCategory.OUTAGE.value
    released = True
    creation_quota = Quota(3600, 60, 60_000)  # 60,000 per hour, sliding window of 60 seconds
    default_priority = PriorityLevel.HIGH
    notification_config = NotificationConfig(context=[])
