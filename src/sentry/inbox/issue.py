from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.types import InboxEventData, InboxEventType, InboxItemType
from sentry.models.group import Group
from sentry.models.organization import Organization


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


@dataclass(frozen=True, kw_only=True)
class IssueAssignedData(InboxEventData):
    assignment_source: Literal["user", "ownership_rule", "seer_suggestion"]


@dataclass(frozen=True, kw_only=True)
class IssueMentionedData(InboxEventData):
    comment_id: int  # Comment reference exposed as commentId by the activity API.


@dataclass(frozen=True, kw_only=True)
class IssuePRReadyForReviewData(InboxEventData):
    pr_url: str
    seer_run_id: int  # Seer DbRunState ID.


ISSUE = IssueItemType()
inbox_item_type_registry.register(ISSUE.subject_type)(ISSUE)

ISSUE_ASSIGNED = InboxEventType(
    event_type="issue.assigned", item_type=ISSUE, data_class=IssueAssignedData
)
ISSUE_MENTIONED = InboxEventType(
    event_type="issue.mentioned", item_type=ISSUE, data_class=IssueMentionedData
)
ISSUE_PR_READY_FOR_REVIEW = InboxEventType(
    event_type="issue.pr_ready_for_review", item_type=ISSUE, data_class=IssuePRReadyForReviewData
)

inbox_item_event_type_registry.register(ISSUE_ASSIGNED.event_type)(ISSUE_ASSIGNED)
inbox_item_event_type_registry.register(ISSUE_MENTIONED.event_type)(ISSUE_MENTIONED)
inbox_item_event_type_registry.register(ISSUE_PR_READY_FOR_REVIEW.event_type)(
    ISSUE_PR_READY_FOR_REVIEW
)
