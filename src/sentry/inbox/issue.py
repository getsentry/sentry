from collections.abc import Sequence
from dataclasses import dataclass
from urllib.parse import urlsplit

from django.db.models import F, FilteredRelation, Q, QuerySet

from sentry.inbox.event_data import (
    InboxEventData,
    IssueAssignedDataResponse,
    IssueMentionedDataResponse,
    IssuePRReadyForReviewDataResponse,
)
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.response_types import InboxIssueSubjectResponse
from sentry.inbox.types import (
    InboxEventSummary,
    InboxEventType,
    InboxItemType,
    InboxSubject,
    with_bigint_subject_pk,
)
from sentry.models.activity import ActivityIntegration
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.types import NotificationSettingEnum


@dataclass(frozen=True, kw_only=True)
class IssueSubject(InboxSubject):
    short_id: str
    project_id: int
    project_slug: str

    def serialize(self) -> InboxIssueSubjectResponse:
        return {
            "id": str(self.id),
            "type": "issue",
            "title": self.title,
            "metadata": {
                "shortId": self.short_id,
                "project": {"id": str(self.project_id), "slug": self.project_slug},
            },
        }


class IssueItemType(InboxItemType[Group]):
    subject_type = "issue"
    subject_match_alias = "issue_project"

    def get_subject_id(self, subject: Group) -> str:
        return str(subject.id)

    def get_organization_id(self, subject: Group) -> int:
        return subject.project.organization_id

    def join_subject(self, items: QuerySet[InboxItem]) -> QuerySet[InboxItem]:
        return (
            with_bigint_subject_pk(items)
            .alias(
                issue=FilteredRelation(
                    "_issue_join",
                    condition=Q(
                        subject_type=self.subject_type, _issue_join__id=F("bigint_subject_pk")
                    ),
                ),
            )
            .alias(
                issue_project=FilteredRelation(
                    "issue__project",
                    condition=Q(issue__project__organization_id=F("organization_id")),
                ),
            )
            .select_related(self.subject_type, self.subject_match_alias)
        )

    def build_subject(self, item: InboxItem) -> IssueSubject:
        subject: Group = getattr(item, self.subject_type)
        # qualified_short_id reads group.project. Reuse the project selected by the scoped join.
        subject.project = getattr(item, self.subject_match_alias)
        return IssueSubject(
            id=subject.id,
            title=subject.title,
            short_id=subject.qualified_short_id or "",
            project_id=subject.project_id,
            project_slug=subject.project.slug,
        )

    def get_url(self, *, organization: Organization, subject_id: str) -> str:
        return organization.absolute_url(
            f"/organizations/{organization.slug}/inbox/issue/{subject_id}/"
        )

    def filter_recipients(self, *, subject: Group, user_ids: Sequence[int]) -> list[int]:
        return list(user_ids)


@dataclass(frozen=True, kw_only=True)
class IssueAssignedData(InboxEventData):
    assignment_source: ActivityIntegration | None
    activity_id: int

    def serialize(self) -> IssueAssignedDataResponse:
        return {"assignmentSource": self.assignment_source, "activityId": str(self.activity_id)}

    def get_url(self, subject_url: str) -> str:
        return urlsplit(subject_url)._replace(fragment=f"activity-{self.activity_id}").geturl()


@dataclass(frozen=True, kw_only=True)
class IssueMentionedData(InboxEventData):
    comment_id: int  # ID of the note activity, exposed as commentId by the activity API.

    def serialize(self) -> IssueMentionedDataResponse:
        return {"commentId": str(self.comment_id)}

    def get_url(self, subject_url: str) -> str:
        return urlsplit(subject_url)._replace(fragment=f"activity-{self.comment_id}").geturl()


@dataclass(frozen=True, kw_only=True)
class IssuePRReadyForReviewData(InboxEventData):
    pr_url: str
    seer_run_id: int  # Seer DbRunState ID.

    def serialize(self) -> IssuePRReadyForReviewDataResponse:
        return {"prUrl": self.pr_url, "seerRunId": str(self.seer_run_id)}


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
