from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.relay import RelayUsage
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class OrganizationRelayResponse(TypedDict):
    relayId: Annotated[str, ApiDescription("ID of the Relay")]
    version: Annotated[str, ApiDescription("Version of the Relay")]
    publicKey: Annotated[str | None, ApiDescription("Public key of the Relay")]
    firstSeen: Annotated[datetime, ApiDescription("When the Relay first connected (ISO 8601)")]
    lastSeen: Annotated[datetime, ApiDescription("When the Relay last connected (ISO 8601)")]


@register(RelayUsage)
class RelayUsageSerializer(Serializer[OrganizationRelayResponse]):
    def serialize(
        self,
        obj: RelayUsage,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> OrganizationRelayResponse:
        return {
            "relayId": obj.relay_id,
            "version": obj.version,
            "firstSeen": obj.first_seen,
            "lastSeen": obj.last_seen,
            "publicKey": obj.public_key,
        }
