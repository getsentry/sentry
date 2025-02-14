from collections.abc import Mapping
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class PlatformExternalIssueSerializerResponse(TypedDict):
    id: str
    issueId: str
    serviceType: str
    displayName: str
    webUrl: str


@register(PlatformExternalIssue)
class PlatformExternalIssueSerializer(Serializer):
    def serialize(
        self,
        obj: PlatformExternalIssue,
        attrs: Mapping[str, Any],
        user: User | AnonymousUser | RpcUser,
        **kwargs: Any,
    ) -> PlatformExternalIssueSerializerResponse:
        return {
            "id": str(obj.id),
            "issueId": str(obj.group_id),
            "serviceType": obj.service_type,
            "displayName": obj.display_name,
            "webUrl": obj.web_url,
        }
