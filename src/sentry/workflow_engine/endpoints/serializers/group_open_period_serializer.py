from collections import defaultdict
from collections.abc import Iterable, Mapping
from datetime import datetime, timedelta
from typing import Annotated, Any, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.group import Group
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.types.group import PriorityLevel


class GroupOpenPeriodActivityResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the activity")]
    type: Annotated[str, ApiDescription("What happened: `opened`, `status_change` or `closed`")]
    value: Annotated[
        str | None, ApiDescription("Issue priority after the activity, such as `high`")
    ]
    dateCreated: Annotated[datetime, ApiDescription("When the activity happened")]
    eventId: Annotated[str | None, ApiDescription("ID of the event that caused the activity")]


class GroupOpenPeriodResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the open period")]
    groupId: Annotated[str, ApiDescription("ID of the issue")]
    shortId: Annotated[str | None, ApiDescription("Short ID of the issue, such as PROJECT-1A")]
    start: Annotated[datetime, ApiDescription("When the issue opened, less `bucketSize`")]
    end: Annotated[
        datetime | None, ApiDescription("When the issue closed, less `bucketSize`. Null while open")
    ]
    isOpen: Annotated[bool, ApiDescription("Whether the open period is still open")]
    activities: Annotated[
        list[GroupOpenPeriodActivityResponse] | None,
        ApiDescription(
            "Activities in the date range, oldest first, up to 100. With `start`, the last "
            "activity before it comes first"
        ),
    ]


class GroupOpenPeriodAttrs(TypedDict):
    activities: list[GroupOpenPeriodActivityResponse]
    short_id: str | None


def get_short_ids_by_group_id(group_ids: Iterable[int]) -> dict[int, str | None]:
    groups = Group.objects.filter(id__in=set(group_ids)).select_related("project")

    return {group.id: group.qualified_short_id for group in groups}


def calculate_event_date_from_update_date(update_date: datetime, time_window: int) -> datetime:
    """
    Calculates the date that an event actually happened based on the date that we
    received the update. This takes into account time window and threshold period.
    :return:
    """
    # Subscriptions label buckets by the end of the bucket, whereas discover
    # labels them by the front. This causes us an off-by-one error with event dates,
    # so to prevent this we subtract a bucket off of the date.
    return update_date - timedelta(seconds=time_window)


@register(GroupOpenPeriodActivity)
class GroupOpenPeriodActivitySerializer(Serializer[GroupOpenPeriodActivityResponse]):
    def serialize(
        self, obj: GroupOpenPeriodActivity, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> GroupOpenPeriodActivityResponse:
        return GroupOpenPeriodActivityResponse(
            id=str(obj.id),
            type=OpenPeriodActivityType(obj.type).to_str(),
            value=PriorityLevel(obj.value).to_str() if obj.value else None,
            dateCreated=obj.date_added,
            eventId=obj.event_id,
        )


@register(GroupOpenPeriod)
class GroupOpenPeriodSerializer(Serializer[GroupOpenPeriodResponse]):
    def get_attrs(
        self, item_list: Any, user: Any, **kwargs: Any
    ) -> dict[GroupOpenPeriod, GroupOpenPeriodAttrs]:
        query_start = kwargs.get("query_start")
        query_end = kwargs.get("query_end")

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
            gopas[activity.group_open_period_id].append(serialized_activity)

        short_ids_by_group_id = get_short_ids_by_group_id(item.group_id for item in item_list)

        return {
            item: GroupOpenPeriodAttrs(
                activities=gopas[item.id][:100],
                short_id=short_ids_by_group_id.get(item.group_id),
            )
            for item in item_list
        }

    def serialize(
        self, obj: GroupOpenPeriod, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> GroupOpenPeriodResponse:
        time_window = kwargs.get("time_window", 0)
        return GroupOpenPeriodResponse(
            id=str(obj.id),
            groupId=str(obj.group_id),
            shortId=attrs["short_id"],
            start=calculate_event_date_from_update_date(obj.date_started, time_window),
            end=(
                calculate_event_date_from_update_date(obj.date_ended, time_window)
                if obj.date_ended is not None
                else None
            ),
            isOpen=obj.date_ended is None,
            activities=attrs.get("activities"),
        )
