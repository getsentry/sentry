import datetime
import hashlib
import hmac
from collections.abc import Callable, Iterator
from typing import Any, Protocol, TypedDict, TypeVar

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

T = TypeVar("T", contravariant=True)


class FlagAuditLogRow(TypedDict):
    """A complete flag audit log row instance."""

    action: int
    created_at: datetime.datetime
    created_by: str
    created_by_type: int
    flag: str
    organization_id: int
    tags: dict[str, Any]


class ProviderProtocol(Protocol[T]):
    organization_id: int
    provider_name: str
    signature: str | None

    def __init__(self, organization_id: int, signature: str | None) -> None: ...
    def handle(self, message: T) -> list[FlagAuditLogRow]: ...
    def validate(self, message_bytes: bytes) -> bool: ...


class DeserializationError(Exception):
    """The request body could not be deserialized."""

    def __init__(self, errors):
        self.errors = errors


class InvalidProvider(Exception):
    """An unsupported provider type was specified."""

    ...


def get_provider(
    organization_id: int, provider_name: str, headers: HttpHeaders
) -> ProviderProtocol[dict[str, Any]] | None:
    match provider_name:
        case "launchdarkly":
            return LaunchDarklyProvider(organization_id, signature=headers.get("X-LD-Signature"))
        case "generic":
            return GenericProvider(organization_id, signature=headers.get("X-Sentry-Signature"))
        case _:
            return None


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


class LaunchDarklyProvider:
    provider_name = "launchdarkly"

    def __init__(self, organization_id: int, signature: str | None) -> None:
        self.organization_id = organization_id
        self.signature = signature

    def handle(self, message: dict[str, Any]) -> list[FlagAuditLogRow]:
        serializer = LaunchDarklyItemSerializer(data=message)
        if not serializer.is_valid():
            raise DeserializationError(serializer.errors)

        result = serializer.validated_data

        access = result["accesses"][0]
        if access["action"] not in SUPPORTED_LAUNCHDARKLY_ACTIONS:
            return []

        return [
            {
                "action": _handle_launchdarkly_actions(access["action"]),
                "created_at": datetime.datetime.fromtimestamp(
                    result["date"] / 1000.0, datetime.UTC
                ),
                "created_by": result["member"]["email"],
                "created_by_type": CREATED_BY_TYPE_MAP["email"],
                "flag": result["name"],
                "organization_id": self.organization_id,
                "tags": {"description": result["description"]},
            }
        ]

    def validate(self, message_bytes: bytes) -> bool:
        validator = SecretValidator(
            self.organization_id,
            self.provider_name,
            message_bytes,
            self.signature,
        )
        return validator.validate()


def _handle_launchdarkly_actions(action: str) -> int:
    if action == "createFlag" or action == "cloneFlag":
        return ACTION_MAP["created"]
    if action == "deleteFlag":
        return ACTION_MAP["deleted"]
    else:
        return ACTION_MAP["updated"]


"""Generic provider.

The generic provider represents a Sentry-defined generic web hook
interface that anyone can integrate with.
"""


class GenericItemCreatedBySerializer(serializers.Serializer):
    id = serializers.CharField(required=True, max_length=100)
    type = serializers.ChoiceField(choices=(("email", 0), ("id", 1), ("name", 2)), required=True)


class GenericItemSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=(("created", 0), ("updated", 1), ("deleted", 2)), required=True
    )
    change_id = serializers.IntegerField(required=True)
    created_at = serializers.DateTimeField(required=True)
    created_by = GenericItemCreatedBySerializer(required=True)
    flag = serializers.CharField(required=True, max_length=100)


class GenericMetaSerializer(serializers.Serializer):
    version = serializers.IntegerField(required=True)


class GenericRequestSerializer(serializers.Serializer):
    data = GenericItemSerializer(many=True, required=True)  # type: ignore[assignment]
    meta = GenericMetaSerializer(required=True)


class GenericProvider:
    provider_name = "generic"

    def __init__(self, organization_id: int, signature: str | None) -> None:
        self.organization_id = organization_id
        self.signature = signature

    def handle(self, message: dict[str, Any]) -> list[FlagAuditLogRow]:
        serializer = GenericRequestSerializer(data=message)
        if not serializer.is_valid():
            raise DeserializationError(serializer.errors)

        seen = set()
        result: list[FlagAuditLogRow] = []
        for item in serializer.validated_data["data"]:
            if item["change_id"] not in seen:
                seen.add(item["change_id"])
                result.append(
                    {
                        "action": ACTION_MAP[item["action"]],
                        "created_at": item["created_at"],
                        "created_by": item["created_by"]["id"],
                        "created_by_type": CREATED_BY_TYPE_MAP[item["created_by"]["type"]],
                        "flag": item["flag"],
                        "organization_id": self.organization_id,
                        "tags": {},
                    }
                )

        return result

    def validate(self, message_bytes: bytes) -> bool:
        validator = SecretValidator(
            self.organization_id,
            self.provider_name,
            message_bytes,
            self.signature,
        )
        return validator.validate()


"""Flagpole provider."""


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


"""Helpers."""


class SecretValidator:
    """Abstract payload validator.

    Allows us to inject dependencies for differing use cases. Specifically
    the test suite.
    """

    def __init__(
        self,
        organization_id: int,
        provider: str,
        request_body: bytes,
        signature: str | None,
        secret_finder: Callable[[int, str], Iterator[str]] | None = None,
        secret_validator: Callable[[str, bytes], str] | None = None,
    ) -> None:
        self.organization_id = organization_id
        self.provider = provider
        self.request_body = request_body
        self.signature = signature
        self.secret_finder = secret_finder or _query_signing_secrets
        self.secret_validator = secret_validator or hmac_sha256_hex_digest

    def validate(self) -> bool:
        if self.signature is None:
            return False

        for secret in self.secret_finder(self.organization_id, self.provider):
            if self.secret_validator(secret, self.request_body) == self.signature:
                return True
        return False


def _query_signing_secrets(organization_id: int, provider: str) -> Iterator[str]:
    for model in FlagWebHookSigningSecretModel.objects.filter(
        organization_id=organization_id,
        provider=provider,
    ).all():
        yield model.secret


def hmac_sha256_hex_digest(key: str, message: bytes):
    return hmac.new(key.encode(), message, hashlib.sha256).hexdigest()
