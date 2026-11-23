from typing import Literal, TypedDict

from django.db.models import Exists, F, OuterRef, Q, QuerySet
from rest_framework import serializers

from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxItemEvent

UNREAD_ITEMS = Q(last_read_at__isnull=True) | Q(last_read_at__lt=F("last_activity_at"))


class InboxFilters(TypedDict, total=False):
    subject_type: list[str]
    subject_id: str
    event_type: list[str]
    recipient: list[Literal["team", "user"]]
    id: list[int]
    is_read: Literal["true", "false"]


class InboxFilterSerializer(serializers.Serializer[InboxFilters]):
    subject_type = serializers.ListField(
        child=serializers.ChoiceField(choices=tuple(inbox_item_type_registry.registrations)),
        required=False,
        help_text="Filter by subject type. Investigations use `notebook`.",
    )
    subject_id = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
        help_text="Filter by subject ID. Requires exactly one `subject_type`.",
    )
    event_type = serializers.ListField(
        child=serializers.ChoiceField(choices=tuple(inbox_item_event_type_registry.registrations)),
        required=False,
        help_text="Filter by event type.",
    )
    id = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="Filter by inbox item IDs.",
    )
    recipient = serializers.ListField(
        child=serializers.ChoiceField(choices=("team", "user")),
        required=False,
        help_text=(
            "Filter by events addressed to a team (`team`) or the authenticated user (`user`). "
            "When combined with `event_type`, both filters must match the same event."
        ),
    )
    is_read = serializers.ChoiceField(
        choices=("true", "false"),
        required=False,
        help_text="Filter by whether inbox items have been read.",
    )

    def validate(self, attrs: InboxFilters) -> InboxFilters:
        if "subject_id" in attrs and len(attrs.get("subject_type", [])) != 1:
            raise serializers.ValidationError("subject_id requires exactly one subject_type.")
        return attrs


def filter_inbox_items(items: QuerySet[InboxItem], filters: InboxFilters) -> QuerySet[InboxItem]:
    subject_types = filters.get("subject_type")
    event_types = filters.get("event_type")
    recipients = filters.get("recipient")

    if subject_types:
        items = items.filter(subject_type__in=subject_types)
    if "subject_id" in filters:
        items = items.filter(subject_id=filters["subject_id"])
    if event_types or recipients:
        matching_event_types = event_types or inbox_item_event_type_registry.registrations.keys()
        if recipients:
            matching_event_types = [
                event_type
                for event_type in matching_event_types
                if inbox_item_event_type_registry.get(event_type).recipient in recipients
            ]
        items = items.filter(
            Exists(
                InboxItemEvent.objects.filter(
                    inbox_item_id=OuterRef("pk"), type__in=matching_event_types
                )
            )
        )
    if "id" in filters:
        items = items.filter(id__in=filters["id"])
    is_read = filters.get("is_read")
    if is_read == "true":
        items = items.exclude(UNREAD_ITEMS)
    elif is_read == "false":
        items = items.filter(UNREAD_ITEMS)
    return items
