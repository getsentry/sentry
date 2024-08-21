from typing import Any

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.base import serialize
from sentry.models.notificationhistory import NotificationHistory


@register(NotificationHistory)
class OutgoingNotificationHistorySerializer(Serializer):
    def serialize(self, obj: NotificationHistory, attrs, user, **kwargs) -> dict[str, Any]:
        return {
            "id": obj.id,
            "title": obj.title,
            "description": obj.description,
            "status": obj.status,
            "source": obj.source,
            "content": obj.content,
            "team": serialize(obj.team) if obj.team else None,
            "user_id": obj.user_id,
            "date_added": obj.date_added,
            "date_updated": obj.date_added,
        }
