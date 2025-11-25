from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.incidents.utils.process_update_helpers import calculate_event_date_from_update_date
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.types.group import PriorityLevel


class GroupOpenPeriodActivityResponse(TypedDict):
    id: str
    type: str
    value: str | None
    dateCreated: datetime


class GroupOpenPeriodResponse(TypedDict):
    id: str
    start: datetime
    end: datetime | None
    isOpen: bool
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
            dateCreated=obj.date_added,
        )


@register(GroupOpenPeriod)
class GroupOpenPeriodSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        query_start = kwargs.get("query_start")
        query_end = kwargs.get("query_end")
        result: defaultdict[GroupOpenPeriod, dict[str, list[GroupOpenPeriodActivityResponse]]] = (
            defaultdict(dict)
        )

        activities = GroupOpenPeriodActivity.objects.filter(group_open_period__in=item_list)

        first_activity_qs = GroupOpenPeriodActivity.objects.none()

        if query_start:
            first_activity = (
                activities.filter(date_added__lt=query_start).order_by("-date_added").first()
            )

            if first_activity:
                first_activity_qs = GroupOpenPeriodActivity.objects.filter(pk=first_activity.pk)

            activities = activities.filter(date_added__gte=query_start)

        if query_end:
            activities = activities.filter(date_added__lte=query_end)

        activities = first_activity_qs.union(activities).order_by("date_added")

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
        time_window = kwargs.get("time_window", 0)
        return GroupOpenPeriodResponse(
            id=str(obj.id),
            start=calculate_event_date_from_update_date(obj.date_started, time_window),
            end=(
                calculate_event_date_from_update_date(obj.date_ended, time_window)
                if obj.date_ended is not None
                else None
            ),
            isOpen=obj.date_ended is None,
            activities=attrs.get("activities"),
        )
