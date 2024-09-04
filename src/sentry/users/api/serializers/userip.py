from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.users.models.user import User
from sentry.users.models.userip import UserIP


class UserIPSerializerResponse(TypedDict):
    id: str
    ipAddress: str
    countryCode: str | None
    regionCode: str | None
    lastSeen: datetime
    firstSeen: datetime


@register(UserIP)
class UserIPSerializer(Serializer):
    def serialize(
        self, obj: UserIP, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> UserIPSerializerResponse:
        return {
            "id": str(obj.id),
            "ipAddress": obj.ip_address,
            "countryCode": obj.country_code,
            "regionCode": obj.region_code,
            "lastSeen": obj.last_seen,
            "firstSeen": obj.first_seen,
        }
