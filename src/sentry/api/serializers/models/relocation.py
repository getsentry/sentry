from typing import Any, Mapping, MutableMapping, Sequence

from sentry.api.serializers import Serializer, register
from sentry.models.relocation import Relocation
from sentry.models.user import User
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.utils.json import JSONData


@register(Relocation)
class RelocationSerializer(Serializer):
    def serialize(
        self, obj: Relocation, attrs: Mapping[int, RpcUser], user: User, **kwargs: Any
    ) -> Mapping[str, JSONData]:
        scheduled_at_pause_step = (
            Relocation.Step(obj.scheduled_pause_at_step).name
            if obj.scheduled_pause_at_step is not None
            else None
        )
        scheduled_at_cancel_step = (
            Relocation.Step(obj.scheduled_cancel_at_step).name
            if obj.scheduled_cancel_at_step is not None
            else None
        )
        latest_notified = (
            Relocation.EmailKind(obj.latest_notified).name
            if obj.latest_notified is not None
            else None
        )

        return {
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
            "uuid": str(obj.uuid),
            "creatorEmail": attrs[obj.creator_id].email,
            "creatorId": str(obj.creator_id),
            "creatorUsername": attrs[obj.creator_id].username,
            "ownerEmail": attrs[obj.owner_id].email,
            "ownerId": str(obj.owner_id),
            "ownerUsername": attrs[obj.owner_id].username,
            "status": Relocation.Status(obj.status).name,
            "step": Relocation.Step(obj.step).name,
            "failureReason": obj.failure_reason,
            "scheduledPauseAtStep": scheduled_at_pause_step,
            "scheduledCancelAtStep": scheduled_at_cancel_step,
            "wantOrgSlugs": obj.want_org_slugs,
            "wantUsernames": obj.want_usernames,
            "latestNotified": latest_notified,
            "latestUnclaimedEmailsSentAt": obj.latest_unclaimed_emails_sent_at,
        }

    def get_attrs(
        self, item_list: Sequence[Relocation], user: User, **kwargs: Any
    ) -> MutableMapping[Relocation, Mapping[int, RpcUser]]:
        user_ids = set()
        for relocation in item_list:
            user_ids.add(relocation.creator_id)
            user_ids.add(relocation.owner_id)

        users = user_service.get_many(filter=dict(user_ids=list(user_ids)))
        user_map = {u.id: u for u in users}
        return {r: user_map for r in item_list}
