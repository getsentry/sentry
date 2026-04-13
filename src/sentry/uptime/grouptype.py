from __future__ import annotations

import logging
from dataclasses import dataclass

from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckResult

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel
from sentry.uptime.models import UptimeSubscription
from sentry.uptime.types import GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE
from sentry.workflow_engine.types import (
    DetectorType,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class UptimePacketValue:
    """
    Represents the value passed into the uptime detector
    """

    check_result: CheckResult
    subscription: UptimeSubscription
    metric_tags: dict[str, str]


@dataclass(frozen=True)
class UptimeDomainCheckFailure(GroupType):
    type_id = 7001
    slug = GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE
    description = "Uptime Domain Monitor Failure"
    released = True
    category = GroupCategory.UPTIME.value
    category_v2 = GroupCategory.OUTAGE.value
    creation_quota = Quota(3600, 60, 1000)  # 1000 per hour, sliding window of 60 seconds
    default_priority = PriorityLevel.HIGH
    enable_auto_resolve = False
    enable_escalation_detection = False
    detector_type = DetectorType.UPTIME_DOMAIN_CHECK_FAILURE
