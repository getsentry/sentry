import datetime
from typing import Any

from rest_framework import serializers

from sentry.flags.exceptions import DeserializationError
from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP
from sentry.flags.providers import FlagAuditLogRow


class LaunchDarklyItemSerializer(serializers.Serializer):
    """Docs reference: https://apidocs.launchdarkly.com/tag/Audit-log/#operation/getAuditLogEntry"""

    accesses = serializers.ListField(required=True)
    date = serializers.IntegerField(required=True)
    member = serializers.DictField(required=True)
    name = serializers.CharField(max_length=100, required=True)
    description = serializers.CharField(required=True)


"""
LaunchDarkly has a lot more flag actions than what's in our
ACTION_MAP. The "updated" action is the catch-all for actions
that don't fit in the other buckets.

We started out with a few actions that we think would be useful
to accept. All other actions will not be logged
to the audit log. This set of actions is subject to change.
"""

# A subset chosen from https://docs.launchdarkly.com/home/account/role-actions#feature-flag-actions
SUPPORTED_LAUNCHDARKLY_ACTIONS = (
    "createFlag",
    "cloneFlag",
    "deleteFlag",
    "updateFallthrough",
    "updateOffVariation",
    "updateOn",
    "updateRules",
    "updateScheduledChanges",
    "updateDeprecated",
    "updateFlagDefaultVariations",
    "updateFlagVariations",
    "updateGlobalArchived",
    "updateRulesWithMeasuredRollout",
    "updateFallthroughWithMeasuredRollout",
    "updatePrerequisites",
    "stopMeasuredRolloutOnFlagFallthrough",
    "stopMeasuredRolloutOnFlagRule",
)


def handle_launchdarkly_actions(action: str) -> int:
    if action == "createFlag" or action == "cloneFlag":
        return ACTION_MAP["created"]
    if action == "deleteFlag":
        return ACTION_MAP["deleted"]
    else:
        return ACTION_MAP["updated"]


def handle_launchdarkly_event(
    request_data: dict[str, Any], organization_id: int
) -> list[FlagAuditLogRow]:
    serializer = LaunchDarklyItemSerializer(data=request_data)
    if not serializer.is_valid():
        raise DeserializationError(serializer.errors)

    result = serializer.validated_data

    return [
        {
            "action": handle_launchdarkly_actions(access["action"]),
            "created_at": datetime.datetime.fromtimestamp(result["date"] / 1000.0, datetime.UTC),
            "created_by": result["member"]["email"],
            "created_by_type": CREATED_BY_TYPE_MAP["email"],
            "flag": result["name"],
            "organization_id": organization_id,
            "tags": {"description": result["description"]},
        }
        for access in result["accesses"]
        if access["action"] in SUPPORTED_LAUNCHDARKLY_ACTIONS
    ]
