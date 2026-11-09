from collections import defaultdict
from collections.abc import Collection, Iterable

from django.db import router, transaction
from django.db.models import Q

from sentry import features
from sentry.inbox.registry import inbox_item_type_registry
from sentry.inbox.types import InboxActor, InboxEventData, InboxEventType
from sentry.integrations.types import ExternalProviders
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxActorType, InboxItemEvent
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.strategies.utils import get_targets_from_participant_map
from sentry.notifications.platform.templates.inbox import InboxItemNotificationData
from sentry.notifications.platform.types import NotificationTarget
from sentry.notifications.types import GroupSubscriptionReason
from sentry.notifications.utils.participants import ParticipantMap
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import notifications_tasks
from sentry.types.actor import Actor, ActorType
from sentry.users.services.user.service import user_service


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
    notifies them about it by email and Slack after the transaction commits. Recipients outside
    the subject's organization are dropped, and a user reached more than once gets one event.
    """
    recipient_user_ids = _get_recipient_user_ids(
        organization_id=event_type.item_type.get_organization_id(subject), recipients=recipients
    )
    events = event_type.record(
        subject=subject, data=data, recipient_user_ids=recipient_user_ids, actor=actor
    )
    if not events:
        return

    organization = events[0].inbox_item.organization
    if not features.has("organizations:inbox-notifications", organization):
        return

    event_ids = [event.id for event in events]
    transaction.on_commit(
        lambda: send_inbox_notifications.delay(event_ids=event_ids),
        using=router.db_for_write(InboxItemEvent),
    )


def _get_recipient_user_ids(*, organization_id: int, recipients: Iterable[Actor]) -> list[int]:
    user_ids: set[int] = set()
    team_ids: set[int] = set()
    for recipient in recipients:
        (team_ids if recipient.is_team else user_ids).add(recipient.id)
    if not user_ids and not team_ids:
        return []

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


def get_inbox_notification_targets(
    *, organization_id: int, user_ids: Collection[int]
) -> dict[int, list[NotificationTarget]]:
    """Each user's email and Slack DM targets, keyed by user ID."""
    participant_map = ParticipantMap()
    for user_id in user_ids:
        recipient = Actor(id=user_id, actor_type=ActorType.USER)
        for provider in (ExternalProviders.EMAIL, ExternalProviders.SLACK):
            participant_map.add(provider, recipient, GroupSubscriptionReason.implicit)

    targets: dict[int, list[NotificationTarget]] = defaultdict(list)
    for target in get_targets_from_participant_map(
        participant_map, organization_id=organization_id
    ):
        if target.specific_data is not None:
            targets[target.specific_data["user_id"]].append(target)
    return targets


def _get_actor_names(events: Iterable[InboxItemEvent]) -> dict[int, str]:
    user_ids = {
        event.actor_id
        for event in events
        if event.actor_type == InboxActorType.USER and event.actor_id is not None
    }
    if not user_ids:
        return {}
    return {
        user.id: user.get_display_name() for user in user_service.get_many_by_id(ids=list(user_ids))
    }


def _get_actor_name(event: InboxItemEvent, actor_names: dict[int, str]) -> str:
    if event.actor_type == InboxActorType.SYSTEM or event.actor_id is None:
        return "Sentry"
    return actor_names.get(event.actor_id, "A former member")


def _get_inbox_url(organization: Organization, item: InboxItem) -> str:
    return organization.absolute_url(
        f"/organizations/{organization.slug}/inbox/{item.subject_type}/{item.subject_id}/"
    )


@instrumented_task(
    name="sentry.notifications.platform.inbox.send_inbox_notifications",
    namespace=notifications_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def send_inbox_notifications(*, event_ids: list[int]) -> None:
    events = list(
        InboxItemEvent.objects.filter(id__in=event_ids).select_related("inbox_item__organization")
    )
    grouped_events: dict[tuple[int, str], list[InboxItemEvent]] = defaultdict(list)
    for event in events:
        grouped_events[event.inbox_item.organization_id, event.inbox_item.subject_type].append(
            event
        )

    actor_names = _get_actor_names(events)
    for (_, subject_type), group in grouped_events.items():
        organization = group[0].inbox_item.organization
        item_type = inbox_item_type_registry.registrations.get(subject_type)
        if item_type is None:
            continue
        titles = item_type.get_titles(
            organization=organization,
            subject_ids=[event.inbox_item.subject_id for event in group],
        )
        targets = get_inbox_notification_targets(
            organization_id=organization.id,
            user_ids={event.inbox_item.user_id for event in group},
        )

        for event in group:
            item = event.inbox_item
            subject_title = titles.get(item.subject_id)
            user_targets = targets.get(item.user_id)
            if subject_title is None or not user_targets:
                continue
            data = InboxItemNotificationData(
                organization_id=organization.id,
                inbox_item_id=item.id,
                event_type=event.type,
                subject_title=subject_title,
                summary=event.data["summary"],
                actor_name=_get_actor_name(event, actor_names),
                inbox_url=_get_inbox_url(organization, item),
            )
            NotificationService(data=data).notify_async(targets=user_targets)
