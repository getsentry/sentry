from collections.abc import Sequence
from dataclasses import dataclass

from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.types import InboxEventData, InboxEventSummary, InboxEventType, InboxItemType
from sentry.models.activity import ActivityIntegration
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.notifications.types import NotificationSettingEnum


class IssueItemType(InboxItemType[Group]):
    subject_type = "issue"

    def get_subject_id(self, subject: Group) -> str:
        return str(subject.id)

    def get_organization_id(self, subject: Group) -> int:
        return subject.project.organization_id

    def get_titles(
        self, *, organization: Organization, subject_ids: Sequence[str]
    ) -> dict[str, str]:
        ids = [int(subject_id) for subject_id in subject_ids if subject_id.isdecimal()]
        groups = Group.objects.filter(project__organization_id=organization.id, id__in=ids)
        return {str(group.id): group.title for group in groups}

    def get_url(self, *, organization: Organization, subject_id: str) -> str:
        return organization.absolute_url(f"/organizations/{organization.slug}/issues/{subject_id}/")

    def filter_recipients(self, *, subject: Group, user_ids: Sequence[int]) -> list[int]:
        return list(user_ids)


@dataclass(frozen=True, kw_only=True)
class IssueAssignedData(InboxEventData):
    assignment_source: ActivityIntegration | None


@dataclass(frozen=True, kw_only=True)
class IssueMentionedData(InboxEventData):
    comment_id: int  # Comment reference exposed as commentId by the activity API.


@dataclass(frozen=True, kw_only=True)
class IssuePRReadyForReviewData(InboxEventData):
    pr_url: str
    seer_run_id: int  # Seer DbRunState ID.


ISSUE = IssueItemType()
inbox_item_type_registry.register(ISSUE.subject_type)(ISSUE)

ISSUE_USER_ASSIGNED = InboxEventType(
    event_type="issue.user_assigned",
    summary=InboxEventSummary.ISSUE_USER_ASSIGNED,
    item_type=ISSUE,
    data_class=IssueAssignedData,
    notification_setting=NotificationSettingEnum.INBOX_ASSIGNMENTS,
)
ISSUE_TEAM_ASSIGNED = InboxEventType(
    recipient="team",
    event_type="issue.team_assigned",
    summary=InboxEventSummary.ISSUE_TEAM_ASSIGNED,
    item_type=ISSUE,
    data_class=IssueAssignedData,
    notification_setting=NotificationSettingEnum.INBOX_ASSIGNMENTS,
)
ISSUE_USER_MENTIONED = InboxEventType(
    event_type="issue.user_mentioned",
    summary=InboxEventSummary.ISSUE_USER_MENTIONED,
    item_type=ISSUE,
    data_class=IssueMentionedData,
    notification_setting=NotificationSettingEnum.INBOX_MENTIONS,
)
ISSUE_TEAM_MENTIONED = InboxEventType(
    recipient="team",
    event_type="issue.team_mentioned",
    summary=InboxEventSummary.ISSUE_TEAM_MENTIONED,
    item_type=ISSUE,
    data_class=IssueMentionedData,
    notification_setting=NotificationSettingEnum.INBOX_MENTIONS,
)
ISSUE_PR_READY_FOR_REVIEW = InboxEventType(
    event_type="issue.pr_ready_for_review",
    summary=InboxEventSummary.ISSUE_PR_READY_FOR_REVIEW,
    item_type=ISSUE,
    data_class=IssuePRReadyForReviewData,
    notification_setting=NotificationSettingEnum.INBOX_PULL_REQUESTS_READY,
)

inbox_item_event_type_registry.register(ISSUE_USER_ASSIGNED.event_type)(ISSUE_USER_ASSIGNED)
inbox_item_event_type_registry.register(ISSUE_TEAM_ASSIGNED.event_type)(ISSUE_TEAM_ASSIGNED)
inbox_item_event_type_registry.register(ISSUE_USER_MENTIONED.event_type)(ISSUE_USER_MENTIONED)
inbox_item_event_type_registry.register(ISSUE_TEAM_MENTIONED.event_type)(ISSUE_TEAM_MENTIONED)
inbox_item_event_type_registry.register(ISSUE_PR_READY_FOR_REVIEW.event_type)(
    ISSUE_PR_READY_FOR_REVIEW
)
