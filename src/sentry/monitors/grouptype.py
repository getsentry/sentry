from __future__ import annotations
from typing import int

from dataclasses import dataclass

from sentry_redis_tools.sliding_windows_rate_limiter import Quota

from sentry.issues.grouptype import GroupCategory, GroupType, NotificationConfig
from sentry.monitors.validators import MonitorIncidentDetectorValidator
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.types import DetectorSettings


@dataclass(frozen=True)
class MonitorIncidentType(GroupType):
    type_id = 4001
    slug = "monitor_check_in_failure"
    description = "Crons Monitor Failed"
    category = GroupCategory.CRON.value
    category_v2 = GroupCategory.OUTAGE.value
    released = True
    creation_quota = Quota(3600, 60, 60_000)  # 60,000 per hour, sliding window of 60 seconds
    default_priority = PriorityLevel.HIGH
    notification_config = NotificationConfig(context=[])
    detector_settings = DetectorSettings(
        handler=None,
        validator=MonitorIncidentDetectorValidator,
        config_schema={},
    )
