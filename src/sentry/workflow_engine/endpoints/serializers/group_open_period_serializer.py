from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.models.groupopenperiod import GroupOpenPeriod, get_last_checked_for_open_period
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.types.group import PriorityLevel


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
    activities: list[GroupOpenPeriodActivityResponse] | None


@register(GroupOpenPeriodActivity)
class GroupOpenPeriodActivitySerializer(Serializer):
    def serialize(
        self, obj: GroupOpenPeriodActivity, attrs: Mapping[str, Any], user, **kwargs
    ) -> GroupOpenPeriodActivityResponse:
        return GroupOpenPeriodActivityResponse(
            id=str(obj.id),
            type=OpenPeriodActivityType(obj.type).to_str(),
            value=PriorityLevel(obj.value).to_str() if obj.value else None,
        )


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
        return GroupOpenPeriodResponse(
            id=str(obj.id),
            start=obj.date_started,
            end=obj.date_ended,
            duration=obj.date_ended - obj.date_started if obj.date_ended else None,
            isOpen=obj.date_ended is None,
            lastChecked=get_last_checked_for_open_period(obj.group),
            activities=attrs.get("activities"),
        )
