from collections.abc import Mapping
from datetime import datetime
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.models.recentsearch import RecentSearch
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class RecentSearchSerializerResponse(TypedDict):
    id: str
    organizationId: str
    type: int
    query: str
    lastSeen: datetime
    dateCreated: datetime


@register(RecentSearch)
class RecentSearchSerializer(Serializer[RecentSearchSerializerResponse]):
    def serialize(
        self,
        obj: RecentSearch,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> RecentSearchSerializerResponse:
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "type": obj.type,
            "query": obj.query,
            "lastSeen": obj.last_seen,
            "dateCreated": obj.date_added,
        }
