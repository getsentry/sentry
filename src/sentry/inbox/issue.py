from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from django.db.models import Q

from sentry import features
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.types import (
    InboxActor,
    InboxEventData,
    InboxEventType,
    InboxItemType,
)
from sentry.models.activity import ActivityIntegration
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.notifications.platform.strategies.issue_owners import IssueOwnersActivityAlertStrategy
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


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

ISSUE_ASSIGNED = InboxEventType(
    event_type="issue.assigned", item_type=ISSUE, data_class=IssueAssignedData
)
ISSUE_USER_MENTIONED = InboxEventType(
    event_type="issue.user_mentioned", item_type=ISSUE, data_class=IssueMentionedData
)
ISSUE_TEAM_MENTIONED = InboxEventType(
    event_type="issue.team_mentioned", item_type=ISSUE, data_class=IssueMentionedData
)
ISSUE_PR_READY_FOR_REVIEW = InboxEventType(
    event_type="issue.pr_ready_for_review", item_type=ISSUE, data_class=IssuePRReadyForReviewData
)

inbox_item_event_type_registry.register(ISSUE_ASSIGNED.event_type)(ISSUE_ASSIGNED)
inbox_item_event_type_registry.register(ISSUE_USER_MENTIONED.event_type)(ISSUE_USER_MENTIONED)
inbox_item_event_type_registry.register(ISSUE_TEAM_MENTIONED.event_type)(ISSUE_TEAM_MENTIONED)
inbox_item_event_type_registry.register(ISSUE_PR_READY_FOR_REVIEW.event_type)(
    ISSUE_PR_READY_FOR_REVIEW
)


def _get_recipient_user_ids(
    group: Group, *, user_ids: Iterable[int], team_ids: Iterable[int]
) -> list[int]:
    members = OrganizationMember.objects.filter(
        Q(user_id__in=user_ids)
        | Q(
            organizationmemberteam__team_id__in=team_ids,
            organizationmemberteam__team__organization_id=group.project.organization_id,
            organizationmemberteam__is_active=True,
        ),
        organization_id=group.project.organization_id,
        user_is_active=True,
    )
    return [
        user_id
        for user_id in members.values_list("user_id", flat=True).distinct()
        if user_id is not None
    ]


def record_issue_assignment(
    *,
    group: Group,
    assignee: Team | User | RpcUser,
    assignment_source: ActivityIntegration | None,
    actor: InboxActor,
) -> None:
    if not features.has("organizations:universal-inbox-recording", group.project.organization):
        return

    is_team = isinstance(assignee, Team)
    ISSUE_ASSIGNED.record(
        subject=group,
        data=IssueAssignedData(
            summary="Assigned to your team" if is_team else "Assigned to you",
            assignment_source=assignment_source,
        ),
        recipient_user_ids=_get_recipient_user_ids(
            group,
            user_ids=[] if is_team else [assignee.id],
            team_ids=[assignee.id] if is_team else [],
        ),
        actor=actor,
    )


def record_issue_user_mention(
    *,
    group: Group,
    comment_id: int,
    mentioned_user_ids: Iterable[int],
    actor: InboxActor,
) -> None:
    if not features.has("organizations:universal-inbox-recording", group.project.organization):
        return

    ISSUE_USER_MENTIONED.record(
        subject=group,
        data=IssueMentionedData(summary="Mentioned you in a comment", comment_id=comment_id),
        recipient_user_ids=_get_recipient_user_ids(group, user_ids=mentioned_user_ids, team_ids=[]),
        actor=actor,
    )


def record_issue_team_mention(
    *,
    group: Group,
    comment_id: int,
    mentioned_team_ids: Iterable[int],
    actor: InboxActor,
) -> None:
    if not features.has("organizations:universal-inbox-recording", group.project.organization):
        return

    ISSUE_TEAM_MENTIONED.record(
        subject=group,
        data=IssueMentionedData(summary="Mentioned your team in a comment", comment_id=comment_id),
        recipient_user_ids=_get_recipient_user_ids(group, user_ids=[], team_ids=mentioned_team_ids),
        actor=actor,
    )


def record_issue_pr_ready_for_review(
    *, group: Group, pr_urls: Sequence[str], seer_run_id: int, actor: InboxActor
) -> None:
    if not features.has("organizations:universal-inbox-recording", group.project.organization):
        return

    user_ids, team_ids = IssueOwnersActivityAlertStrategy(group=group).get_issue_owner_ids()
    recipients = _get_recipient_user_ids(group, user_ids=user_ids, team_ids=team_ids)
    for pr_url in pr_urls:
        ISSUE_PR_READY_FOR_REVIEW.record(
            subject=group,
            data=IssuePRReadyForReviewData(
                summary="Pull request ready for review", pr_url=pr_url, seer_run_id=seer_run_id
            ),
            recipient_user_ids=recipients,
            actor=actor,
        )
