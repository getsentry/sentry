import datetime
from typing import Any

from rest_framework import serializers

from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP
from sentry.flags.providers import DeserializationError, FlagAuditLogRow

# Keys are a subset of the list at https://docs.getunleash.io/reference/integrations/webhook#configuration.
EVENT_TO_ACTION_MAP: dict[str, str] = {
    "feature-created": "created",
    "feature-revived": "created",
    "feature-archived": "deleted",
    "feature-deleted": "deleted",  # Not listed in webhooks docs, but seems like it should be. Need to test.
    "feature-environment-enabled": "updated",
    "feature-environment-disabled": "updated",
    "feature-project-change": "updated",
    "feature-strategy-add": "updated",
    "feature-strategy-remove": "updated",
    "feature-strategy-update": "updated",
    "feature-updated": "updated",  # Deprecated in v4.3
    "feature-variants-updated": "updated",  # Need to test, may be deprecated (can't find docs)
}


class UnleashedItemSerializer(serializers.Serializer):
    """Schema reference: https://docs.getunleash.io/reference/events"""

    featureName = serializers.CharField(required=True)  # Included by all event types we care about.
    id = serializers.IntegerField(required=True)
    type = serializers.CharField(required=True)
    createdAt = serializers.DateTimeField(
        required=True,
        input_formats=["iso-8601"],
        format=None,  # outputs datetime object
        default_timezone=datetime.UTC,
    )
    createdBy = serializers.EmailField(required=True)

    createdByUserId = serializers.IntegerField(required=False)
    data = serializers.DictField(required=False)
    preData = serializers.DictField(required=False)
    tags = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()), required=False
    )  # Tag format is {type: str, value: str}. https://docs.getunleash.io/reference/api/unleash/get-tags
    project = serializers.CharField(required=False)
    environment = serializers.CharField(required=False)
    label = serializers.CharField(required=False)
    summary = serializers.CharField(required=False)


def handle_unleashed_event(
    request_data: dict[str, Any], organization_id: int
) -> list[FlagAuditLogRow]:
    event_type = request_data.get("type", "")
    if event_type not in EVENT_TO_ACTION_MAP:
        return []

    serializer = UnleashedItemSerializer(data=request_data)
    if not serializer.is_valid():
        raise DeserializationError(serializer.errors)
    event = serializer.validated_data

    action: int = ACTION_MAP[EVENT_TO_ACTION_MAP[event_type]]
    formatted_tags = {tag["type"]: tag["value"] for tag in event.get("tags", {})}
    formatted_tags["project"] = event.get("project")
    formatted_tags["environment"] = event.get("environment")
    # TODO: can add 'inferred_value' (bool) tag for some events, using the `data` field + others.

    return [
        {
            "action": action,
            "created_at": event["createdAt"],
            "created_by": event["createdBy"],
            "created_by_type": CREATED_BY_TYPE_MAP["email"],
            "flag": event["featureName"],
            "organization_id": organization_id,
            "tags": formatted_tags,
        }
    ]
