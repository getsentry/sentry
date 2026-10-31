from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import Count, F, Q

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.inbox.registry import inbox_item_type_registry
from sentry.inbox.response_types import (
    InboxActorResponse,
    InboxItemEventResponse,
    InboxItemResponse,
)
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxActorType, InboxItemEvent
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


@register(InboxItemEvent)
class InboxItemEventSerializer(Serializer[InboxItemEventResponse]):
    def get_attrs(
        self, item_list: Sequence[InboxItemEvent], user: Any, **kwargs: Any
    ) -> dict[InboxItemEvent, dict[str, Any]]:
        user_ids = {
            event.actor_id
            for event in item_list
            if event.actor_type == InboxActorType.USER and event.actor_id is not None
        }
        serialized_users = []
        if user_ids:
            serialized_users = user_service.serialize_many(
                filter={"user_ids": list(user_ids)}, as_user=serialize_generic_user(user)
            )
        users = {serialized["id"]: serialized for serialized in serialized_users}
        return {event: {"user": users.get(str(event.actor_id))} for event in item_list}

    def serialize(
        self, obj: InboxItemEvent, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> InboxItemEventResponse:
        actor: InboxActorResponse
        if obj.actor_type == InboxActorType.SYSTEM:
            actor = {"type": "system", "id": None, "name": "Sentry", "avatar": None}
        else:
            actor_user = attrs["user"]
            actor = {
                "type": "user",
                "id": str(obj.actor_id),
                "name": actor_user["name"] if actor_user else "A former member",
                "avatar": actor_user.get("avatar") if actor_user else None,
            }
        data = convert_dict_key_case(
            {key: value for key, value in obj.data.items() if key != "summary"}, snake_to_camel_case
        )
        for key, value in data.items():
            if key.endswith("Id") and value is not None:
                data[key] = str(value)
        last_read_at = obj.inbox_item.last_read_at
        return {
            "id": str(obj.id),
            "type": obj.type,
            "actor": actor,
            "data": data,
            "summary": obj.data["summary"],
            "isUnread": last_read_at is None or obj.date_added > last_read_at,
            "dateAdded": obj.date_added,
        }


@register(InboxItem)
class InboxItemSerializer(Serializer[InboxItemResponse]):
    def get_attrs(
        self, item_list: Sequence[InboxItem], user: Any, **kwargs: Any
    ) -> dict[InboxItem, dict[str, Any]]:
        events = InboxItemEvent.objects.filter(inbox_item_id__in=[item.id for item in item_list])
        stats = {
            row["inbox_item_id"]: row
            for row in events.values("inbox_item_id").annotate(
                event_count=Count("id"),
                event_types=ArrayAgg("type", distinct=True, order_by="type"),
                unread_event_count=Count(
                    "id",
                    filter=Q(inbox_item__last_read_at__isnull=True)
                    | Q(date_added__gt=F("inbox_item__last_read_at")),
                ),
            )
        }
        latest_events = list(
            events.select_related("inbox_item")
            .order_by("inbox_item_id", "-date_added", "-id")
            .distinct("inbox_item_id")
        )
        latest = {
            event.inbox_item_id: response
            for event, response in zip(
                latest_events, serialize(latest_events, user, InboxItemEventSerializer())
            )
        }
        grouped_items: dict[tuple[int, str], list[InboxItem]] = defaultdict(list)
        for item in item_list:
            grouped_items[item.organization_id, item.subject_type].append(item)
        titles = {}
        for (_, subject_type), items in grouped_items.items():
            item_type = inbox_item_type_registry.registrations.get(subject_type)
            if item_type is None:
                continue
            subject_titles = item_type.get_titles(
                organization=items[0].organization,
                subject_ids=[item.subject_id for item in items],
            )
            titles.update({item.id: subject_titles.get(item.subject_id) for item in items})
        return {
            item: {"title": titles.get(item.id), "latest_event": latest[item.id], **stats[item.id]}
            for item in item_list
        }

    def serialize(
        self, obj: InboxItem, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> InboxItemResponse:
        return {
            "id": str(obj.id),
            "subjectType": obj.subject_type,
            "subjectId": obj.subject_id,
            "title": attrs["title"],
            "subtitle": attrs["latest_event"]["summary"],
            "eventTypes": attrs["event_types"],
            "eventCount": attrs["event_count"],
            "unreadEventCount": attrs["unread_event_count"],
            "latestEvent": attrs["latest_event"],
            "isUnread": obj.last_read_at is None or obj.last_read_at < obj.last_activity_at,
            "lastActivityAt": obj.last_activity_at,
            "lastReadAt": obj.last_read_at,
        }
