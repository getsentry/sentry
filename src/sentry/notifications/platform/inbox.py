from collections.abc import Iterable

from django.db.models import Q

from sentry.inbox.types import InboxActor, InboxEventData, InboxEventType
from sentry.models.organizationmember import OrganizationMember
from sentry.types.actor import Actor


def create_inbox_items[SubjectT, DataT: InboxEventData](
    *,
    event_type: InboxEventType[SubjectT, DataT],
    subject: SubjectT,
    data: DataT,
    recipients: Iterable[Actor],
    actor: InboxActor,
) -> None:
    """
    Records one inbox event for each user recipient and each member of each team recipient.
    Recipients outside the subject's organization are dropped, and a user reached more than once
    gets one event.
    """
    recipient_user_ids = _get_recipient_user_ids(
        organization_id=event_type.item_type.get_organization_id(subject), recipients=recipients
    )
    event_type.record(
        subject=subject, data=data, recipient_user_ids=recipient_user_ids, actor=actor
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
