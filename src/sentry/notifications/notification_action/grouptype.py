from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import md5
from uuid import uuid4

from sentry.event_manager import set_tag
from sentry.eventstore.models import GroupEvent
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_consumer import process_event_and_issue_occurrence
from sentry.models.organization import Organization
from sentry.ratelimits.sliding_windows import Quota
from sentry.utils.samples import load_data
from sentry.workflow_engine.tasks.utils import fetch_event


@dataclass(frozen=True)
class SendTestNotification(GroupType):
    type_id = 9001
    slug = "send-test-notification"
    description = "Send test notification"
    category = GroupCategory.TEST_NOTIFICATION.value
    category_v2 = GroupCategory.TEST_NOTIFICATION.value
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


def get_test_notification_event_data(project) -> GroupEvent | None:

    occurrence = IssueOccurrence(
        id=uuid4().hex,
        project_id=project.id,
        event_id=uuid4().hex,
        fingerprint=[md5(str(uuid4()).encode("utf-8")).hexdigest()],
        issue_title="Test Issue",
        subtitle="Test issue created to test a notification related action",
        resource_id=None,
        evidence_data={},
        evidence_display=[],
        type=SendTestNotification,
        detection_time=datetime.now(UTC),
        level="error",
        culprit="Test notification",
    )

    # Load mock data
    event_data = load_data(
        platform=project.platform,
        default="javascript",
        event_id=occurrence.event_id,
    )

    # Setting this tag shows the sample event banner in the UI
    set_tag(event_data, "sample_event", "yes")

    event_data["project_id"] = occurrence.project_id

    occurrence, group_info = process_event_and_issue_occurrence(occurrence.to_dict(), event_data)
    if group_info is None:
        return None

    generic_group = group_info.group

    event = fetch_event(occurrence.event_id, occurrence.project_id)

    if event is None:
        return None

    return GroupEvent.from_event(event, generic_group)
