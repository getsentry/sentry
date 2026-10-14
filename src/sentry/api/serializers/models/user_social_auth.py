from collections.abc import Mapping
from typing import Any, TypedDict

from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from social_auth.models import UserSocialAuth


def get_provider_label(obj: UserSocialAuth) -> str:
    return settings.AUTH_PROVIDER_LABELS[obj.provider]


class UserSocialAuthSerializerResponse(TypedDict):
    id: str
    provider: str
    providerLabel: str


@register(UserSocialAuth)
class UserSocialAuthSerializer(Serializer[UserSocialAuthSerializerResponse]):
    def serialize(
        self,
        obj: UserSocialAuth,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> UserSocialAuthSerializerResponse:
        return {
            "id": str(obj.id),
            "provider": obj.provider,
            "providerLabel": get_provider_label(obj),
        }
