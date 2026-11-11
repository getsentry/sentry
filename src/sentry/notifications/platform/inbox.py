from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Any, Protocol

from django.db import router, transaction

from sentry import features
from sentry.inbox.issue import (
    ISSUE_TEAM_MENTIONED,
    ISSUE_USER_MENTIONED,
    IssueMentionedData,
)
from sentry.inbox.types import InboxActor, InboxEventData, InboxEventType, get_recipient_user_ids
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.notifications.types import NotificationSettingEnum
from sentry.types.actor import Actor


class InboxNotifier[SubjectT, DataT: InboxEventData](Protocol):
    def notify(self, *, subject: SubjectT, data: DataT, user_ids: list[int]) -> None: ...


@dataclass(frozen=True)
class IssueActivityInboxNotifier[DataT: InboxEventData]:
    """Notifies users about an issue inbox event using the notification for its activity."""

    settings_key: NotificationSettingEnum
    get_activity_id: Callable[[DataT], int]

    def notify(self, *, subject: Group, data: DataT, user_ids: list[int]) -> None:
        from sentry.notifications.platform.strategies.actor_routing import UserRoutingStrategy

        activity = Activity.objects.filter(
            id=self.get_activity_id(data), group_id=subject.id
        ).first()
        if activity is None:
            return

        strategy = UserRoutingStrategy(
            project=subject.project, user_ids=user_ids, settings_key=self.settings_key
        )
        for target in strategy.get_targets():
            # TODO(ISWF-3737): Build the activity's notification data for this target and send it.
            pass


_MENTION_NOTIFIER = IssueActivityInboxNotifier[IssueMentionedData](
    settings_key=NotificationSettingEnum.WORKFLOW,
    get_activity_id=lambda data: data.comment_id,
)

INBOX_NOTIFIERS: dict[str, InboxNotifier[Any, Any]] = {
    ISSUE_USER_MENTIONED.event_type: _MENTION_NOTIFIER,
    ISSUE_TEAM_MENTIONED.event_type: _MENTION_NOTIFIER,
}


def create_inbox_items[SubjectT, DataT: InboxEventData](
    *,
    event_type: InboxEventType[SubjectT, DataT],
    subject: SubjectT,
    data: DataT,
    recipients: Iterable[Actor],
    actor: InboxActor,
) -> None:
    """
    Records one inbox event for each user recipient and each member of each team recipient, then
    notifies the users who got a new event, per their personal settings, after the transaction
    commits. Recipients outside the subject's organization are dropped, and a user reached more
    than once gets one event.
    """
    user_ids: set[int] = set()
    team_ids: set[int] = set()
    for recipient in recipients:
        (team_ids if recipient.is_team else user_ids).add(recipient.id)
    recipient_user_ids = get_recipient_user_ids(
        organization_id=event_type.item_type.get_organization_id(subject),
        user_ids=user_ids,
        team_ids=team_ids,
    )
    events = event_type.record(
        subject=subject, data=data, recipient_user_ids=recipient_user_ids, actor=actor
    )

    notifier = INBOX_NOTIFIERS.get(event_type.event_type)
    if not events or notifier is None:
        return
    if not features.has("organizations:inbox-notifications", events[0].inbox_item.organization):
        return

    notified_user_ids = [event.inbox_item.user_id for event in events]
    transaction.on_commit(
        lambda: notifier.notify(subject=subject, data=data, user_ids=notified_user_ids),
        using=router.db_for_write(InboxItemEvent),
    )
