from collections.abc import Callable, Iterable
from dataclasses import dataclass

from django.db import router, transaction
from django.db.models import Q

from sentry import features
from sentry.inbox.types import InboxActor, InboxEventData, InboxEventType
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.notifications.types import NotificationSettingEnum
from sentry.types.actor import Actor


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
    organization = Organization.objects.get_from_cache(
        id=event_type.item_type.get_organization_id(subject)
    )
    if not features.has("organizations:universal-inbox-recording", organization):
        return

    events = event_type.record(
        subject=subject,
        data=data,
        recipient_user_ids=_get_recipient_user_ids(
            organization_id=organization.id, recipients=recipients
        ),
        actor=actor,
    )

    notifier = event_type.notifier
    if not events or notifier is None:
        return
    if not features.has("organizations:inbox-notifications", organization):
        return

    user_ids = [event.inbox_item.user_id for event in events]
    transaction.on_commit(
        lambda: notifier.notify(subject=subject, data=data, user_ids=user_ids),
        using=router.db_for_write(InboxItemEvent),
    )


def _get_recipient_user_ids(*, organization_id: int, recipients: Iterable[Actor]) -> list[int]:
    user_ids: set[int] = set()
    team_ids: set[int] = set()
    for recipient in recipients:
        (team_ids if recipient.is_team else user_ids).add(recipient.id)

    members = OrganizationMember.objects.filter(
        Q(user_id__in=user_ids)
        | Q(
            organizationmemberteam__team_id__in=team_ids,
            organizationmemberteam__team__organization_id=organization_id,
            organizationmemberteam__is_active=True,
        ),
        organization_id=organization_id,
        user_is_active=True,
    )
    return [
        user_id
        for user_id in members.values_list("user_id", flat=True).distinct()
        if user_id is not None
    ]
