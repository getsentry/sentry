from collections.abc import Mapping
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail
from sentry.users.services.user import RpcUser


class UserEmailSerializerResponse(TypedDict):
    email: str
    isPrimary: bool
    isVerified: bool


@register(UserEmail)
class UserEmailSerializer(Serializer):
    def serialize(
        self,
        obj: UserEmail,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> UserEmailSerializerResponse:
        if isinstance(user, AnonymousUser):
            raise TypeError("must pass user=... to serialize(...)")
        primary_email = UserEmail.objects.get_primary_email(user)
        return {
            "email": obj.email,
            "isPrimary": obj.email == primary_email.email,
            "isVerified": obj.is_verified,
        }
