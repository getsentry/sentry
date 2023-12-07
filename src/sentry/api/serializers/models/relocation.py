from typing import Any, Mapping

from sentry.api.serializers import Serializer, register
from sentry.models.relocation import Relocation
from sentry.utils.json import JSONData


@register(Relocation)
class RelocationSerializer(Serializer):
    def serialize(
        self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> Mapping[str, JSONData]:
        assert isinstance(obj, Relocation)

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
            "creatorId": str(obj.creator_id),
            "ownerId": str(obj.owner_id),
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
