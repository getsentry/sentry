from typing import Literal, TypedDict

from django.db.models import BigIntegerField, Case, Exists, F, OuterRef, Q, QuerySet, When
from django.db.models.functions import Cast
from rest_framework import serializers

from sentry.db.models.fields.bounded import I64_MAX
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.models.group import Group
from sentry.notebooks.models import Notebook
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
        child=serializers.CharField(trim_whitespace=False),
        required=False,
        help_text="Match any of these registered subject types.",
    )
    subject_id = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
        help_text="Subject ID; requires exactly one subject_type.",
    )
    event_type = serializers.ListField(
        child=serializers.CharField(trim_whitespace=False),
        required=False,
        help_text="Match items containing any of these event types.",
    )
    id = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="Select personal inbox item IDs.",
    )
    recipient = serializers.ListField(
        child=serializers.ChoiceField(choices=("team", "user")),
        required=False,
        help_text="Match items containing events addressed to a team or directly to you.",
    )
    is_read = serializers.ChoiceField(
        choices=("true", "false"),
        required=False,
        help_text="Filter by read state. Omit for both.",
    )

    def validate(self, attrs: InboxFilters) -> InboxFilters:
        if set(attrs.get("subject_type", [])) - inbox_item_type_registry.registrations.keys():
            raise serializers.ValidationError("Unknown subject type.")
        if set(attrs.get("event_type", [])) - inbox_item_event_type_registry.registrations.keys():
            raise serializers.ValidationError("Unknown event type.")
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


def filter_existing_subjects(items: QuerySet[InboxItem]) -> QuerySet[InboxItem]:
    # Cast only canonical IDs in range so stale references cannot fail the query.
    subject_pk = Case(
        When(
            Q(subject_id__regex=r"^(0|[1-9][0-9]{0,17})$")
            | Q(subject_id__regex=r"^[1-9][0-9]{18}$", subject_id__lte=str(I64_MAX)),
            then=Cast("subject_id", BigIntegerField()),
        ),
    )
    issues = Group.objects.filter(
        id=OuterRef("subject_pk"), project__organization_id=OuterRef("organization_id")
    )
    notebooks = Notebook.objects.filter(
        id=OuterRef("subject_pk"), organization_id=OuterRef("organization_id")
    )
    return items.alias(subject_pk=subject_pk).filter(
        Q(Exists(issues), subject_type="issue") | Q(Exists(notebooks), subject_type="notebook")
    )
