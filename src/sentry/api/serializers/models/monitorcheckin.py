from datetime import datetime

from typing_extensions import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models import MonitorCheckIn


@register(MonitorCheckIn)
class MonitorCheckInSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.guid),
            "status": obj.get_status_display(),
            "duration": obj.duration,
            "dateCreated": obj.date_added,
            "attachmentId": obj.attachment_id,
        }


class MonitorCheckInSerializerResponse(TypedDict):
    id: str
    status: str
    duration: int
    dateCreated: datetime
    attachmentId: str
