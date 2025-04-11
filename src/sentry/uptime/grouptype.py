from __future__ import annotations

from dataclasses import dataclass

from sentry.issues import grouptype
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel


@dataclass(frozen=True)
class UptimeDomainCheckFailure(GroupType):
    type_id = 7001
    slug = "uptime_domain_failure"
    description = "Uptime Domain Monitor Failure"
    category = GroupCategory.UPTIME.value
    creation_quota = Quota(3600, 60, 1000)  # 1000 per hour, sliding window of 60 seconds
    default_priority = PriorityLevel.HIGH
    enable_auto_resolve = False
    enable_escalation_detection = False
    detector_config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "A representation of an uptime alert",
        "type": "object",
        "required": ["mode", "environment"],
        "properties": {
            "mode": {
                "type": ["integer"],
                # TODO: Enable this when we can move this grouptype out of this file
                # "enum": [mode.value for mode in ProjectUptimeSubscriptionMode],
            },
            "environment": {"type": ["string"]},
        },
        "additionalProperties": False,
    }
    use_flagpole_for_all_features = True


# XXX: Temporary hack to work around pickling issues
grouptype.UptimeDomainCheckFailure = UptimeDomainCheckFailure  # type: ignore[attr-defined]
