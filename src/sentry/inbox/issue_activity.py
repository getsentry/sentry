import logging
from collections.abc import Iterator
from functools import partial

from sentry.inbox.issue import (
    ISSUE_TEAM_ASSIGNED,
    ISSUE_TEAM_MENTIONED,
    ISSUE_USER_ASSIGNED,
    ISSUE_USER_MENTIONED,
    IssueAssignedData,
    IssueMentionedData,
)
from sentry.inbox.types import SYSTEM_ACTOR, InboxActor
from sentry.models.activity import Activity, ActivityIntegration
from sentry.models.group import Group
from sentry.notifications.platform.inbox import create_inbox_items
from sentry.types.activity import ActivityType
from sentry.types.actor import ActorType

logger = logging.getLogger(__name__)


def _recipient_id(value: object) -> int | None:
    if isinstance(value, str) and value.isascii() and value.isdecimal() and len(value) <= 19:
        value = int(value)
    if type(value) is int and 0 < value < 2**63:
        return value
    return None


def issue_activity_inbox_calls(activity: Activity, group: Group) -> Iterator[partial[None]]:
    """Build one platform call per event type from the persisted activity."""
    if not isinstance(activity.data, dict):
        return
    actor = InboxActor.user(activity.user_id) if activity.user_id is not None else SYSTEM_ACTOR
    if activity.type == ActivityType.ASSIGNED.value:
        assignee = _recipient_id(activity.data.get("assignee"))
        kind = activity.data.get("assigneeType")
        if assignee is None or kind not in ("user", "team"):
            return
        integration = activity.data.get("integration")
        try:
            source = ActivityIntegration(integration) if integration is not None else None
        except ValueError:
            logger.exception("inbox.issue_activity.invalid_integration")
            return
        is_team = kind == "team"
        yield partial(
            create_inbox_items,
            event_type=ISSUE_TEAM_ASSIGNED if is_team else ISSUE_USER_ASSIGNED,
            subject=group,
            data=IssueAssignedData(activity_id=activity.id, assignment_source=source),
            actor=actor,
            user_ids=[] if is_team else [assignee],
            team_ids=[assignee] if is_team else [],
        )
    elif activity.type == ActivityType.NOTE.value:
        mentions = activity.data.get("mentions")
        if not isinstance(mentions, list):
            return
        users: set[int] = set()
        teams: set[int] = set()
        for mention in mentions:
            if (
                not isinstance(mention, dict)
                or (target := _recipient_id(mention.get("id"))) is None
            ):
                continue
            if mention.get("actor_type") == ActorType.USER:
                users.add(target)
            elif mention.get("actor_type") == ActorType.TEAM:
                teams.add(target)
        data = IssueMentionedData(comment_id=activity.id)
        if users:
            yield partial(
                create_inbox_items,
                event_type=ISSUE_USER_MENTIONED,
                subject=group,
                data=data,
                actor=actor,
                user_ids=users,
            )
        if teams:
            yield partial(
                create_inbox_items,
                event_type=ISSUE_TEAM_MENTIONED,
                subject=group,
                data=data,
                actor=actor,
                team_ids=teams,
            )
