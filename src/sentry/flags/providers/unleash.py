import datetime
from typing import Any

from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from sentry.flags.exceptions import DeserializationError
from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP
from sentry.flags.providers import FlagAuditLogRow

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


class UnleashEventSerializer(serializers.Serializer):
    """Schema reference: https://docs.getunleash.io/reference/events"""

    featureName = serializers.CharField(required=True)  # Included by all event types we care about.
    id = serializers.IntegerField(required=True)
    type = serializers.CharField(required=True)
    createdAt = serializers.DateTimeField(
        required=True,
        input_formats=["iso-8601"],
        format=None,  # Outputs datetime object.
        default_timezone=datetime.UTC,
    )
    createdBy = serializers.CharField(
        required=True
    )  # Contrary to docs, this is either an email or username.

    createdByUserId = serializers.IntegerField(required=False, allow_null=True)
    data = serializers.DictField(required=False, allow_null=True)
    preData = serializers.DictField(required=False, allow_null=True)
    tags = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()), required=False, allow_null=True
    )  # Tag format is {type: str, value: str}. https://docs.getunleash.io/reference/api/unleash/get-tags
    project = serializers.CharField(required=False, allow_null=True)
    environment = serializers.CharField(required=False, allow_null=True)
    label = serializers.CharField(required=False, allow_null=True)
    summary = serializers.CharField(required=False, allow_null=True)


def _get_user(validated_event: dict[str, Any]) -> tuple[str, int]:
    """Prefer email > ID > username. Subject to change."""
    created_by = validated_event["createdBy"]
    try:
        serializers.EmailField().run_validation(created_by)
        return created_by, CREATED_BY_TYPE_MAP["email"]
    except ValidationError:
        pass

    if "createdByUserId" in validated_event:
        return validated_event["createdByUserId"], CREATED_BY_TYPE_MAP["id"]
    return created_by, CREATED_BY_TYPE_MAP["name"]


def handle_unleash_event(
    request_data: dict[str, Any], organization_id: int
) -> list[FlagAuditLogRow]:
    event_type = request_data.get("type", "")
    if event_type not in EVENT_TO_ACTION_MAP:
        return []

    serializer = UnleashEventSerializer(data=request_data)
    if not serializer.is_valid():
        raise DeserializationError(serializer.errors)
    event = serializer.validated_data

    action: int = ACTION_MAP[EVENT_TO_ACTION_MAP[event_type]]
    created_by, created_by_type = _get_user(event)

    unleash_tags = event.get("tags") or []
    tags = {tag["type"]: tag["value"] for tag in unleash_tags}
    tags["project"] = event.get("project")
    tags["environment"] = event.get("environment")
    tags["unleash_event_type"] = event_type
    # TODO: can add 'inferred_value' (bool) tag for some events, using the `data` field + others.

    return [
        {
            "action": action,
            "created_at": event["createdAt"],
            "created_by": created_by,
            "created_by_type": created_by_type,
            "flag": event["featureName"],
            "organization_id": organization_id,
            "tags": tags,
        }
    ]
