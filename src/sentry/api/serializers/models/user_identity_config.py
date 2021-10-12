from dataclasses import dataclass
from enum import Enum
from typing import Optional, Union

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import AuthIdentity, Identity, Organization
from social_auth.models import UserSocialAuth

from . import user_social_auth


class Status(Enum):
    CAN_DISCONNECT = "can_disconnect"
    NEEDED_FOR_GLOBAL_AUTH = "needed_for_global_auth"
    NEEDED_FOR_ORG_AUTH = "needed_for_org_auth"


_IDENTITY_CATEGORY_KEYS = {
    UserSocialAuth: "social-identity",
    Identity: "global-identity",
    AuthIdentity: "org-identity",
}
_IDENTITY_CATEGORIES_BY_KEY = {key: the_type for (the_type, key) in _IDENTITY_CATEGORY_KEYS.items()}


IdentityType = Union[UserSocialAuth, Identity, AuthIdentity]


@dataclass(eq=True, frozen=True)
class UserIdentityConfig:
    category: str
    id: int
    provider_name: str
    status: Status
    organization: Optional[Organization]

    @staticmethod
    def wrap(identity: IdentityType, status: Status):
        if isinstance(identity, UserSocialAuth):
            provider_name = user_social_auth.get_provider_label(identity)
            organization = None
        elif isinstance(identity, Identity):
            provider_name = identity.get_provider().name
            organization = None
        elif isinstance(identity, AuthIdentity):
            provider_name = identity.auth_provider.get_provider().name
            organization = identity.auth_provider.organization
        else:
            raise TypeError

        category_key = _IDENTITY_CATEGORY_KEYS[type(identity)]
        return UserIdentityConfig(category_key, identity.id, provider_name, status, organization)

    def get_model_type_for_category(self) -> type:
        return _IDENTITY_CATEGORIES_BY_KEY[self.category]


@register(UserIdentityConfig)
class UserIdentityConfigSerializer(Serializer):
    def serialize(self, obj: UserIdentityConfig, attrs, user):
        return {
            "category": obj.category,
            "id": str(obj.id),
            "providerName": obj.provider_name,
            "status": obj.status.value,
            "organization": serialize(obj.organization),
        }
