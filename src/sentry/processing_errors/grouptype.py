from __future__ import annotations

from dataclasses import dataclass

from sentry_redis_tools.sliding_windows_rate_limiter import Quota

from sentry.issues.grouptype import GroupCategory, GroupType, NotificationConfig
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.types import DetectorSettings


@dataclass(frozen=True)
class SourcemapConfigurationType(GroupType):
    type_id = 13001
    slug = "sourcemap_configuration"
    description = "Source Map Configuration Issue"
    category = GroupCategory.CONFIGURATION.value
    category_v2 = GroupCategory.CONFIGURATION.value
    released = False
    default_priority = PriorityLevel.LOW
    enable_auto_resolve = False
    enable_escalation_detection = False
    creation_quota = Quota(3600, 60, 100)
    notification_config = NotificationConfig(context=[])
    detector_settings = DetectorSettings(
        handler=None,
        validator=None,
        config_schema={},
    )
    enable_user_status_and_priority_changes = False
    # For the moment, we only want to show these issue types in the ui
    enable_status_change_workflow_notifications = False
    enable_workflow_notifications = False
    # We want to show these separately to normal issue types
    in_default_search = False
