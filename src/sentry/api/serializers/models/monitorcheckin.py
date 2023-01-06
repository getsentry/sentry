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
        }


class MonitorCheckInSerializerResponse(TypedDict):
    id: str
    status: str
    duration: int
    dateCreated: datetime
