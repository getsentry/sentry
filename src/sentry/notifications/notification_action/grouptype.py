from __future__ import annotations

from dataclasses import dataclass

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.models.organization import Organization
from sentry.ratelimits.sliding_windows import Quota


@dataclass(frozen=True)
class SendTestNotification(GroupType):
    type_id = 9001
    slug = "send-test-notification"
    description = "Send test notification"
    category = GroupCategory.TEST_NOTIFICATION.value
    released = False
    in_default_search = False
    enable_auto_resolve = True
    enable_escalation_detection = False
    enable_status_change_workflow_notifications = True
    creation_quota = Quota(3600, 60, 1000)  # 1000 per hour, sliding window of 60 seconds

    @classmethod
    def allow_post_process_group(cls, organization: Organization) -> bool:
        return False

    @classmethod
    def allow_ingest(cls, organization: Organization) -> bool:
        return True
