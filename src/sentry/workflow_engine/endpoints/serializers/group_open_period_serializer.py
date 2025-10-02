from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.models.groupopenperiod import GroupOpenPeriod, get_last_checked_for_open_period
from sentry.models.groupopenperiodactivity import (
    OPEN_PERIOD_ACTIVITY_TYPE_TO_STRING,
    GroupOpenPeriodActivity,
)
from sentry.types.group import PRIORITY_LEVEL_TO_STRING


class GroupOpenPeriodActivityResponse(TypedDict):
    id: str
    type: str
    value: str | None


class GroupOpenPeriodResponse(TypedDict):
    id: str
    start: datetime
    end: datetime | None
    duration: timedelta | None
    isOpen: bool
    lastChecked: datetime
    activities: GroupOpenPeriodActivityResponse | None


@register(GroupOpenPeriodActivity)
class GroupOpenPeriodActivitySerializer(Serializer):
    def serialize(
        self, obj: GroupOpenPeriodActivity, attrs: Mapping[str, Any], user, **kwargs
    ) -> GroupOpenPeriodActivityResponse:
        return {
            "id": str(obj.id),
            "type": OPEN_PERIOD_ACTIVITY_TYPE_TO_STRING[obj.type],
            "value": PRIORITY_LEVEL_TO_STRING.get(obj.value),
        }


@register(GroupOpenPeriod)
class GroupOpenPeriodSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        result: defaultdict[GroupOpenPeriod, dict[str, list[GroupOpenPeriodActivityResponse]]] = (
            defaultdict(dict)
        )
        activities = GroupOpenPeriodActivity.objects.filter(
            group_open_period__in=item_list
        ).order_by("id")

        gopas = defaultdict(list)
        for activity, serialized_activity in zip(
            activities, serialize(list(activities), user=user, **kwargs)
        ):
            gopas[activity.group_open_period].append(serialized_activity)
        for item in item_list:
            result[item]["activities"] = gopas[item][:100]

        return result

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
            "activities": attrs.get("activities"),
        }
