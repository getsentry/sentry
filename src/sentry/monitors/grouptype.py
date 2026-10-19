from __future__ import annotations

from dataclasses import dataclass

from sentry_redis_tools.sliding_windows_rate_limiter import Quota

from sentry.issues.grouptype import GroupCategory, GroupType, NotificationConfig
from sentry.monitors.validators import MonitorIncidentDetectorValidator
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import DetectorSettings


@dataclass(frozen=True)
class MonitorIncidentType(GroupType):
    type_id = 4001
    slug = "monitor_check_in_failure"
    description = "Crons Monitor Failed"
    category = GroupCategory.OUTAGE.value
    released = True
    creation_quota = Quota(3600, 60, 60_000)  # 60,000 per hour, sliding window of 60 seconds
    default_priority = PriorityLevel.HIGH
    notification_config = NotificationConfig(context=[])


@detector_settings_registry.register(MonitorIncidentType.slug)
class MonitorIncidentDetectorSettings(DetectorSettings):
    validator = MonitorIncidentDetectorValidator


@dataclass(frozen=True)
class BrokenMonitorConfigurationType(GroupType):
    """
    A cron monitor environment that has been failing long enough that it is
    most likely misconfigured or abandoned, rather than experiencing a
    transient outage.

    While this type is unreleased, its ingest feature flag also controls
    whether the broken and muted monitor emails are replaced by this issue.
    """

    type_id = 13003
    slug = "broken_cron_monitor_configuration"
    description = "Broken Cron Monitor"
    category = GroupCategory.CONFIGURATION.value
    released = False
    default_priority = PriorityLevel.LOW
    enable_auto_resolve = False
    enable_escalation_detection = False
    creation_quota = Quota(3600, 60, 1000)
    notification_config = NotificationConfig(context=[])
    enable_user_status_and_priority_changes = False
    enable_status_change_workflow_notifications = False
    enable_workflow_notifications = False
    in_default_search = False
