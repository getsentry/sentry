from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sentry_redis_tools.sliding_windows_rate_limiter import Quota

from sentry.issues.grouptype import GroupCategory, GroupType, NotificationConfig
from sentry.models.eventerror import EventErrorType
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.types import (
    DetectorType,
)

logger = logging.getLogger(__name__)


class ProcessingErrorCheckStatus(enum.IntEnum):
    """
    Generic pass/fail status used as the comparison value for detector conditions.
    These must match the values used in DataCondition.comparison when
    provisioning the detector.
    """

    SUCCESS = 0
    FAILURE = 1


@dataclass(frozen=True)
class ProcessingErrorPacketValue:
    """
    The data payload passed into processing error detectors via DataPacket.
    Represents the error event that triggered detection.
    """

    event_id: str
    event_data: Mapping[str, Any]


# Error types from symbolicator that indicate sourcemap configuration problems
JS_SOURCEMAP_ERROR_TYPES = frozenset(
    {
        EventErrorType.JS_MISSING_SOURCE,
        EventErrorType.JS_INVALID_SOURCEMAP,
        EventErrorType.JS_MISSING_SOURCES_CONTENT,
        EventErrorType.JS_SCRAPING_DISABLED,
        EventErrorType.JS_INVALID_SOURCEMAP_LOCATION,
    }
)


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
    detector_type = DetectorType.SOURCEMAP_CONFIGURATION
    enable_user_status_and_priority_changes = False
    # For the moment, we only want to show these issue types in the ui
    enable_status_change_workflow_notifications = False
    enable_workflow_notifications = False
    # We want to show these separately to normal issue types
    in_default_search = False
