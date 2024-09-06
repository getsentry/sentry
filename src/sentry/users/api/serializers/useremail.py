from collections.abc import Mapping
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail


class UserEmailSerializerResponse(TypedDict):
    email: str
    isPrimary: bool
    isVerified: bool


@register(UserEmail)
class UserEmailSerializer(Serializer):
    def serialize(
        self, obj: UserEmail, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> UserEmailSerializerResponse:
        primary_email = UserEmail.objects.get_primary_email(user)
        return {
            "email": obj.email,
            "isPrimary": obj.email == primary_email.email,
            "isVerified": obj.is_verified,
        }
