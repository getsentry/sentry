from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import Count, F, Q, prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.inbox.event_data import InboxEventData
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.response_types import (
    InboxActorResponse,
    InboxItemEventResponse,
    InboxItemResponse,
)
from sentry.inbox.types import InboxSubject
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxActorType, InboxItemEvent
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


@register(InboxItemEvent)
class InboxItemEventSerializer(Serializer[InboxItemEventResponse]):
    def get_attrs(
        self, item_list: Sequence[InboxItemEvent], user: Any, **kwargs: Any
    ) -> dict[InboxItemEvent, dict[str, Any]]:
        prefetch_related_objects(item_list, "inbox_item")
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
        event_type = inbox_item_event_type_registry.get(obj.type)
        data: InboxEventData = event_type.data_class.from_payload(obj.data)
        last_read_at = obj.inbox_item.last_read_at
        return {
            "id": str(obj.id),
            "type": obj.type,
            "actor": actor,
            "data": data.serialize(),
            "summary": event_type.summary.value,
            "isUnread": last_read_at is None or obj.date_added > last_read_at,
            "dateAdded": obj.date_added,
        }


@register(InboxItem)
class InboxItemSerializer(Serializer[InboxItemResponse | None]):
    def get_attrs(
        self, item_list: Sequence[InboxItem], user: Any, **kwargs: Any
    ) -> dict[InboxItem, dict[str, Any]]:
        grouped_items: dict[tuple[int, str], list[InboxItem]] = defaultdict(list)
        for item in item_list:
            grouped_items[item.organization_id, item.subject_type].append(item)
        resolved: dict[InboxItem, tuple[Organization, InboxSubject]] = {}
        for (_, subject_type), items in grouped_items.items():
            item_type = inbox_item_type_registry.registrations.get(subject_type)
            if item_type is None:
                continue
            organization = items[0].organization
            subjects = item_type.get_subjects(
                organization=organization, subject_ids=[item.subject_id for item in items]
            )
            for item in items:
                if (subject := subjects.get(item.subject_id)) is not None:
                    resolved[item] = (organization, subject)

        events = InboxItemEvent.objects.filter(inbox_item_id__in=[item.id for item in resolved])
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
        latest_by_item = {event.inbox_item_id: event for event in latest_events}
        attrs: dict[InboxItem, dict[str, Any]] = {}
        for item, (organization, subject) in resolved.items():
            event = latest_by_item[item.id]
            attrs[item] = {
                "subject": subject,
                "url": inbox_item_event_type_registry.get(event.type).get_event_url(
                    organization=organization, event=event
                ),
                "latest_event": latest[item.id],
                **stats[item.id],
            }
        return attrs

    def serialize(
        self, obj: InboxItem, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> InboxItemResponse | None:
        subject: InboxSubject | None = attrs.get("subject")
        if subject is None:
            return None
        return {
            "id": str(obj.id),
            "subject": subject.serialize(),
            "url": attrs["url"],
            "subtitle": attrs["latest_event"]["summary"],
            "eventTypes": attrs["event_types"],
            "eventCount": attrs["event_count"],
            "unreadEventCount": attrs["unread_event_count"],
            "latestEvent": attrs["latest_event"],
            "isUnread": obj.last_read_at is None or obj.last_read_at < obj.last_activity_at,
            "lastActivityAt": obj.last_activity_at,
            "lastReadAt": obj.last_read_at,
        }
