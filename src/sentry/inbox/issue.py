from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

from sentry import roles
from sentry.constants import ObjectStatus
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
    InboxNotifier,
    InboxSubject,
)
from sentry.models.activity import Activity, ActivityIntegration
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import TeamStatus
from sentry.notifications.platform.templates.activity.base import build_activity_notification_data
from sentry.notifications.types import NotificationSettingEnum

if TYPE_CHECKING:
    from sentry.notifications.platform.types import NotificationData, NotificationTarget


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

    def get_subject_id(self, subject: Group) -> str:
        return str(subject.id)

    def get_organization_id(self, subject: Group) -> int:
        return subject.project.organization_id

    def get_subjects(
        self, *, organization: Organization, subject_ids: Sequence[str]
    ) -> dict[str, IssueSubject]:
        ids = [int(subject_id) for subject_id in subject_ids if subject_id.isdecimal()]
        groups = Group.objects.filter(
            project__organization_id=organization.id, id__in=ids
        ).select_related("project")
        return {
            str(group.id): IssueSubject(
                id=group.id,
                title=group.title,
                short_id=group.qualified_short_id or "",
                project_id=group.project_id,
                project_slug=group.project.slug,
            )
            for group in groups
        }

    def get_url(self, *, organization: Organization, subject_id: str) -> str:
        return organization.absolute_url(
            f"/organizations/{organization.slug}/inbox/issue/{subject_id}/"
        )

    def filter_recipients(self, *, subject: Group, user_ids: Sequence[int]) -> list[int]:
        """The given users with access to the issue's project, by the rules of
        ``OrganizationMemberAccess.has_project_access``."""
        project = subject.project
        if not user_ids or project.status != ObjectStatus.ACTIVE:
            return []
        members_by_user_id = {
            member.user_id: member
            for member in OrganizationMember.objects.filter(
                organization_id=project.organization_id, user_id__in=user_ids, user_is_active=True
            )
            if member.user_id is not None
        }
        if project.organization.flags.allow_joinleave:
            return list(members_by_user_id)
        team_member_ids = set(
            OrganizationMemberTeam.objects.filter(
                organizationmember__in=members_by_user_id.values(),
                is_active=True,
                team__status=TeamStatus.ACTIVE,
                team__projectteam__project=project,
            ).values_list("organizationmember_id", flat=True)
        )
        return [
            user_id
            for user_id, member in members_by_user_id.items()
            if roles.get(member.role).is_global or member.id in team_member_ids
        ]


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
    activity_id: int
    pr_urls: list[str]
    seer_run_id: int  # Seer DbRunState ID.

    def serialize(self) -> IssuePRReadyForReviewDataResponse:
        return {
            "activityId": str(self.activity_id),
            "prUrls": self.pr_urls,
            "seerRunId": str(self.seer_run_id),
        }

    def get_url(self, subject_url: str) -> str:
        return urlsplit(subject_url)._replace(fragment=f"activity-{self.activity_id}").geturl()


@dataclass(frozen=True)
class IssueActivityNotifier[DataT: InboxEventData](InboxNotifier[Group, DataT]):
    """Sends the issue's activity notification for the Activity the event records."""

    get_activity_id: Callable[[DataT], int]

    def get_notification_data(
        self,
        *,
        subject: Group,
        data: DataT,
        url: str,
        target: NotificationTarget,
    ) -> NotificationData:
        activity = Activity.objects.get(id=self.get_activity_id(data), group=subject)
        return build_activity_notification_data(activity, target=target, inbox_url=url)


def _get_activity_id(data: IssueAssignedData | IssuePRReadyForReviewData) -> int:
    return data.activity_id


def _get_comment_activity_id(data: IssueMentionedData) -> int:
    return data.comment_id


ISSUE = IssueItemType()
inbox_item_type_registry.register(ISSUE.subject_type)(ISSUE)

ISSUE_USER_ASSIGNED = InboxEventType(
    event_type="issue.user_assigned",
    summary=InboxEventSummary.ISSUE_USER_ASSIGNED,
    item_type=ISSUE,
    data_class=IssueAssignedData,
    notification_setting=NotificationSettingEnum.INBOX_ASSIGNMENTS,
    notifier=IssueActivityNotifier[IssueAssignedData](get_activity_id=_get_activity_id),
)
ISSUE_TEAM_ASSIGNED = InboxEventType(
    recipient="team",
    event_type="issue.team_assigned",
    summary=InboxEventSummary.ISSUE_TEAM_ASSIGNED,
    item_type=ISSUE,
    data_class=IssueAssignedData,
    notification_setting=NotificationSettingEnum.INBOX_ASSIGNMENTS,
    notifier=IssueActivityNotifier[IssueAssignedData](get_activity_id=_get_activity_id),
)
ISSUE_USER_MENTIONED = InboxEventType(
    event_type="issue.user_mentioned",
    summary=InboxEventSummary.ISSUE_USER_MENTIONED,
    item_type=ISSUE,
    data_class=IssueMentionedData,
    notification_setting=NotificationSettingEnum.INBOX_MENTIONS,
    notifier=IssueActivityNotifier[IssueMentionedData](get_activity_id=_get_comment_activity_id),
)
ISSUE_TEAM_MENTIONED = InboxEventType(
    recipient="team",
    event_type="issue.team_mentioned",
    summary=InboxEventSummary.ISSUE_TEAM_MENTIONED,
    item_type=ISSUE,
    data_class=IssueMentionedData,
    notification_setting=NotificationSettingEnum.INBOX_MENTIONS,
    notifier=IssueActivityNotifier[IssueMentionedData](get_activity_id=_get_comment_activity_id),
)
ISSUE_PR_READY_FOR_REVIEW = InboxEventType(
    event_type="issue.pr_ready_for_review",
    summary=InboxEventSummary.ISSUE_PR_READY_FOR_REVIEW,
    item_type=ISSUE,
    data_class=IssuePRReadyForReviewData,
    notification_setting=NotificationSettingEnum.INBOX_PULL_REQUESTS_READY,
    notifier=IssueActivityNotifier[IssuePRReadyForReviewData](get_activity_id=_get_activity_id),
)

inbox_item_event_type_registry.register(ISSUE_USER_ASSIGNED.event_type)(ISSUE_USER_ASSIGNED)
inbox_item_event_type_registry.register(ISSUE_TEAM_ASSIGNED.event_type)(ISSUE_TEAM_ASSIGNED)
inbox_item_event_type_registry.register(ISSUE_USER_MENTIONED.event_type)(ISSUE_USER_MENTIONED)
inbox_item_event_type_registry.register(ISSUE_TEAM_MENTIONED.event_type)(ISSUE_TEAM_MENTIONED)
inbox_item_event_type_registry.register(ISSUE_PR_READY_FOR_REVIEW.event_type)(
    ISSUE_PR_READY_FOR_REVIEW
)
