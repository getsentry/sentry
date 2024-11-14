import datetime
import hashlib
import hmac
from typing import Any, TypedDict

from django.http.request import HttpHeaders
from rest_framework import serializers

from sentry.flags.models import (
    ACTION_MAP,
    CREATED_BY_TYPE_MAP,
    FlagAuditLogModel,
    FlagWebHookSigningSecretModel,
)
from sentry.silo.base import SiloLimit


def write(rows: list["FlagAuditLogRow"]) -> None:
    try:
        FlagAuditLogModel.objects.bulk_create(FlagAuditLogModel(**row) for row in rows)
    except SiloLimit.AvailabilityError:
        pass


"""Provider definitions.

Provider definitions are pure functions. They accept data and return data. Providers do not
initiate any IO operations. Instead they return commands in the form of the return type or
an exception. These commands inform the caller (the endpoint defintion) what IO must be
emitted to satisfy the request. This is done primarily to improve testability and test
performance but secondarily to allow easy extension of the endpoint without knowledge of
the underlying systems.
"""


class FlagAuditLogRow(TypedDict):
    """A complete flag audit log row instance."""

    action: int
    created_at: datetime.datetime
    created_by: str
    created_by_type: int
    flag: str
    organization_id: int
    tags: dict[str, Any]


class DeserializationError(Exception):
    """The request body could not be deserialized."""

    def __init__(self, errors):
        self.errors = errors


class InvalidProvider(Exception):
    """An unsupported provider type was specified."""

    ...


def handle_provider_event(
    provider: str,
    request_data: dict[str, Any],
    organization_id: int,
) -> list[FlagAuditLogRow]:
    match provider:
        case "launchdarkly":
            return handle_launchdarkly_event(request_data, organization_id)
        case _:
            raise InvalidProvider(provider)


def validate_provider_event(
    provider: str,
    request_data: bytes,
    request_headers: HttpHeaders,
    organization_id: int,
) -> bool:
    match provider:
        case "launchdarkly":
            return validate_launchdarkly_event(request_data, request_headers, organization_id)
        case _:
            raise InvalidProvider(provider)


"""LaunchDarkly provider."""


class LaunchDarklyItemSerializer(serializers.Serializer):
    accesses = serializers.ListField(required=True)
    date = serializers.IntegerField(required=True)
    member = serializers.DictField(required=True)
    name = serializers.CharField(max_length=100, required=True)
    description = serializers.CharField(allow_blank=True, required=True)


SUPPORTED_LAUNCHDARKLY_ACTIONS = {
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
}


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

    access = result["accesses"][0]
    if access["action"] not in SUPPORTED_LAUNCHDARKLY_ACTIONS:
        return []

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
    ]


def validate_launchdarkly_event(
    request_data: bytes,
    request_headers: HttpHeaders,
    organization_id: int,
) -> bool:
    """Return "true" if the launchdarkly payload is valid."""
    signature = request_headers.get("X-LD-Signature")
    if signature is None:
        return False

    models = FlagWebHookSigningSecretModel.objects.filter(
        organization_id=organization_id,
        provider="launchdarkly",
    ).all()
    for model in models:
        if hmac_sha256_hex_digest(model.secret, request_data) == signature:
            return True
    return False


def hmac_sha256_hex_digest(key: str, message: bytes):
    return hmac.new(key.encode(), message, hashlib.sha256).hexdigest()


"""Internal flag-pole provider.

Allows us to skip the HTTP endpoint.
"""


class FlagAuditLogItem(TypedDict):
    """A simplified type which is easier to work with than the row definition."""

    action: str
    flag: str
    created_at: datetime.datetime
    created_by: str
    tags: dict[str, str]


def handle_flag_pole_event_internal(items: list[FlagAuditLogItem], organization_id: int) -> None:
    write(
        [
            {
                "action": ACTION_MAP[item["action"]],
                "created_at": item["created_at"],
                "created_by": item["created_by"],
                "created_by_type": CREATED_BY_TYPE_MAP["name"],
                "flag": item["flag"],
                "organization_id": organization_id,
                "tags": item["tags"],
            }
            for item in items
        ]
    )
