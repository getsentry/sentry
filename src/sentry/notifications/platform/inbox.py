from collections.abc import Iterable

from django.db.models import Q

from sentry import features
from sentry.inbox.types import InboxActor, InboxEventData, InboxEventType
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember


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
    more than once gets one event.
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
    event_type.record(
        subject=subject, data=data, recipient_user_ids=recipient_user_ids, actor=actor
    )
    # TODO(ISWF-3737): Check notification settings and send accordingly.


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
