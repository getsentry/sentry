from collections.abc import Iterable, Sequence
from dataclasses import dataclass

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
from sentry.models.team import Team
from sentry.notifications.platform.inbox import IssueActivityInboxNotifier, create_inbox_items
from sentry.notifications.platform.strategies.issue_owners import IssueOwnersActivityAlertStrategy
from sentry.notifications.types import NotificationSettingEnum
from sentry.types.actor import Actor, ActorType
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

ISSUE_USER_ASSIGNED = InboxEventType(
    event_type="issue.user_assigned", item_type=ISSUE, data_class=IssueAssignedData
)
ISSUE_TEAM_ASSIGNED = InboxEventType(
    event_type="issue.team_assigned", item_type=ISSUE, data_class=IssueAssignedData
)
_MENTION_NOTIFIER = IssueActivityInboxNotifier[IssueMentionedData](
    settings_key=NotificationSettingEnum.WORKFLOW,
    get_activity_id=lambda data: data.comment_id,
)
ISSUE_USER_MENTIONED = InboxEventType(
    event_type="issue.user_mentioned",
    item_type=ISSUE,
    data_class=IssueMentionedData,
    notifier=_MENTION_NOTIFIER,
)
ISSUE_TEAM_MENTIONED = InboxEventType(
    event_type="issue.team_mentioned",
    item_type=ISSUE,
    data_class=IssueMentionedData,
    notifier=_MENTION_NOTIFIER,
)
ISSUE_PR_READY_FOR_REVIEW = InboxEventType(
    event_type="issue.pr_ready_for_review", item_type=ISSUE, data_class=IssuePRReadyForReviewData
)

inbox_item_event_type_registry.register(ISSUE_USER_ASSIGNED.event_type)(ISSUE_USER_ASSIGNED)
inbox_item_event_type_registry.register(ISSUE_TEAM_ASSIGNED.event_type)(ISSUE_TEAM_ASSIGNED)
inbox_item_event_type_registry.register(ISSUE_USER_MENTIONED.event_type)(ISSUE_USER_MENTIONED)
inbox_item_event_type_registry.register(ISSUE_TEAM_MENTIONED.event_type)(ISSUE_TEAM_MENTIONED)
inbox_item_event_type_registry.register(ISSUE_PR_READY_FOR_REVIEW.event_type)(
    ISSUE_PR_READY_FOR_REVIEW
)


def record_issue_assignment(
    *,
    group: Group,
    assignee: Team | User | RpcUser,
    assignment_source: ActivityIntegration | None,
    actor: InboxActor,
) -> None:
    is_team = isinstance(assignee, Team)
    create_inbox_items(
        event_type=ISSUE_TEAM_ASSIGNED if is_team else ISSUE_USER_ASSIGNED,
        subject=group,
        data=IssueAssignedData(
            summary="Assigned to your team" if is_team else "Assigned to you",
            assignment_source=assignment_source,
        ),
        recipients=[Actor.from_object(assignee)],
        actor=actor,
    )


def record_issue_user_mention(
    *,
    group: Group,
    comment_id: int,
    mentioned_user_ids: Iterable[int],
    actor: InboxActor,
) -> None:
    create_inbox_items(
        event_type=ISSUE_USER_MENTIONED,
        subject=group,
        data=IssueMentionedData(summary="Mentioned you in a comment", comment_id=comment_id),
        recipients=[Actor(id=user_id, actor_type=ActorType.USER) for user_id in mentioned_user_ids],
        actor=actor,
    )


def record_issue_team_mention(
    *,
    group: Group,
    comment_id: int,
    mentioned_team_ids: Iterable[int],
    actor: InboxActor,
) -> None:
    create_inbox_items(
        event_type=ISSUE_TEAM_MENTIONED,
        subject=group,
        data=IssueMentionedData(summary="Mentioned your team in a comment", comment_id=comment_id),
        recipients=[Actor(id=team_id, actor_type=ActorType.TEAM) for team_id in mentioned_team_ids],
        actor=actor,
    )


def record_issue_pr_ready_for_review(
    *, group: Group, pr_urls: Sequence[str], seer_run_id: int, actor: InboxActor
) -> None:
    if not features.has("organizations:universal-inbox-recording", group.project.organization):
        return

    user_ids, team_ids = IssueOwnersActivityAlertStrategy(group=group).get_issue_owner_ids()
    recipients = [
        *(Actor(id=user_id, actor_type=ActorType.USER) for user_id in user_ids),
        *(Actor(id=team_id, actor_type=ActorType.TEAM) for team_id in team_ids),
    ]
    for pr_url in pr_urls:
        create_inbox_items(
            event_type=ISSUE_PR_READY_FOR_REVIEW,
            subject=group,
            data=IssuePRReadyForReviewData(
                summary="Pull request ready for review", pr_url=pr_url, seer_run_id=seer_run_id
            ),
            recipients=recipients,
            actor=actor,
        )
