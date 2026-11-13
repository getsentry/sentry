from collections.abc import Iterable, Sequence

from django.db.models import Q

from sentry import features
from sentry.inbox.issue import IssueAssignedData, IssueMentionedData, IssuePRReadyForReviewData
from sentry.inbox.types import InboxActor, InboxEventData, InboxEventType
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.types.activity import ActivityType
from sentry.types.actor import ActorType


def create_inbox_items[SubjectT, DataT: InboxEventData](
    *,
    event_type: InboxEventType[SubjectT, DataT],
    subject: SubjectT,
    data: DataT,
    user_ids: Iterable[int] = (),
    team_ids: Iterable[int] = (),
    actor: InboxActor,
) -> None:
    """
    Records one inbox event for each user and each active member of each team. Recipients outside
    the subject's organization or not allowed to see the subject are dropped, and a user reached
    more than once gets one event. Each user with a new event is then notified per their setting
    for the event type.
    """
    organization = Organization.objects.get_from_cache(
        id=event_type.item_type.get_organization_id(subject)
    )
    if not features.has("organizations:universal-inbox-recording", organization):
        return

    recipient_user_ids = event_type.item_type.filter_recipients(
        subject=subject,
        user_ids=_get_recipient_user_ids(
            organization_id=organization.id, user_ids=user_ids, team_ids=team_ids
        ),
    )
    events = event_type.record(
        subject=subject, data=data, recipient_user_ids=recipient_user_ids, actor=actor
    )
    if events and features.has("organizations:universal-inbox-notifications", organization):
        _send_notifications(event_type=event_type, data=data, events=events)


def get_inbox_notified_user_ids(activity: Activity) -> set[int]:
    """
    Users who are notified about the activity through their inbox, and so shouldn't also be
    notified about it as issue subscribers.
    """
    if activity.group_id is None:
        return set()

    data = activity.data or {}
    match activity.type:
        case ActivityType.ASSIGNED.value:
            assignee_id = int(data["assignee"])
            is_team = data.get("assigneeType") == "team"
            user_ids = [] if is_team else [assignee_id]
            team_ids = [assignee_id] if is_team else []
        case ActivityType.NOTE.value:
            mentions = data.get("mentions", [])
            user_ids = [m["id"] for m in mentions if m["actor_type"] == ActorType.USER]
            team_ids = [m["id"] for m in mentions if m["actor_type"] == ActorType.TEAM]
        case _:
            return set()

    organization = Organization.objects.get_from_cache(id=activity.project.organization_id)
    if not features.has(
        "organizations:universal-inbox-recording", organization
    ) or not features.has("organizations:universal-inbox-notifications", organization):
        return set()

    return set(
        _get_recipient_user_ids(
            organization_id=organization.id, user_ids=user_ids, team_ids=team_ids
        )
    )


def _send_notifications[SubjectT, DataT: InboxEventData](
    *,
    event_type: InboxEventType[SubjectT, DataT],
    data: DataT,
    events: Sequence[InboxItemEvent],
) -> None:
    """
    A user is notified about an activity once, for its first inbox event, so an activity recorded
    as several events (one per pull request, or a user and a team mention) sends one notification.
    """
    from sentry.notifications.platform.service import NotificationService
    from sentry.notifications.platform.strategies.actor_routing import UserRoutingStrategy
    from sentry.notifications.platform.templates.activity.base import (
        ActivityNotificationData,
        build_activity_notification_data,
    )

    activity_id = _get_activity_id(data)
    if activity_id is None:
        # TODO(ISWF-3737): Notify about notebook events.
        return

    already_notified_user_ids = _get_user_ids_with_other_activity_events(
        events=events, activity_id=activity_id
    )
    events_by_user_id = {
        event.inbox_item.user_id: event
        for event in events
        if event.inbox_item.user_id not in already_notified_user_ids
    }
    if not events_by_user_id:
        return

    activity = Activity.objects.get(id=activity_id)
    strategy = UserRoutingStrategy(
        project=activity.project,
        user_ids=list(events_by_user_id),
        settings_key=event_type.notification_setting,
    )
    for target in strategy.get_targets():
        user_id = (target.specific_data or {}).get("user_id")
        if not isinstance(user_id, int) or user_id not in events_by_user_id:
            continue
        NotificationService[ActivityNotificationData](
            data=build_activity_notification_data(
                activity=activity, target=target, inbox_event=events_by_user_id[user_id]
            )
        ).notify_async(targets=[target])


def _get_user_ids_with_other_activity_events(
    *, events: Sequence[InboxItemEvent], activity_id: int
) -> set[int]:
    return set(
        InboxItemEvent.objects.filter(
            Q(data__activity_id=activity_id) | Q(data__comment_id=activity_id),
            inbox_item_id__in=[event.inbox_item_id for event in events],
        )
        .exclude(id__in=[event.id for event in events])
        .values_list("inbox_item__user_id", flat=True)
    )


def _get_activity_id(data: InboxEventData) -> int | None:
    match data:
        case IssueAssignedData() | IssuePRReadyForReviewData():
            return data.activity_id
        case IssueMentionedData():
            return data.comment_id
        case _:
            return None


def _get_recipient_user_ids(
    *, organization_id: int, user_ids: Iterable[int], team_ids: Iterable[int]
) -> list[int]:
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
