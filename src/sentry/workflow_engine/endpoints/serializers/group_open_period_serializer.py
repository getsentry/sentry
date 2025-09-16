from typing import Any, TypedDict
from collections.abc import Mapping
from datetime import datetime, timedelta
from sentry.models.groupopenperiod import GroupOpenPeriod, get_last_checked_for_open_period
from sentry.api.serializers import Serializer, register, serialize

class GroupOpenPeriodResponse(TypedDict):
    id: str
    start: datetime
    end: datetime | None
    duration: timedelta | None
    isOpen: bool
    lastChecked: datetime


@register(GroupOpenPeriod)
class GroupOpenPeriodSerializer(Serializer):
    def serialize(
        self, obj: GroupOpenPeriod, attrs: Mapping[str, Any], user, **kwargs
    ) -> GroupOpenPeriodResponse:
        return {
            "id": str(obj.id),
            "start": obj.date_started,
            "end": obj.date_ended,
            "duration": obj.date_ended - obj.date_started if obj.date_ended else None,
            "isOpen": obj.date_ended is None,
            "lastChecked": get_last_checked_for_open_period(obj.group),
        }