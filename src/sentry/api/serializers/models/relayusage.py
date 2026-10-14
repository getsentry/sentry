from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.models.relay import RelayUsage
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class OrganizationRelayResponse(TypedDict):
    relayId: str
    version: str
    publicKey: str | None
    firstSeen: datetime
    lastSeen: datetime


@register(RelayUsage)
class RelayUsageSerializer(Serializer[OrganizationRelayResponse]):
    def serialize(
        self,
        obj: RelayUsage,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OrganizationRelayResponse:
        return {
            "relayId": obj.relay_id,
            "version": obj.version,
            "firstSeen": obj.first_seen,
            "lastSeen": obj.last_seen,
            "publicKey": obj.public_key,
        }
