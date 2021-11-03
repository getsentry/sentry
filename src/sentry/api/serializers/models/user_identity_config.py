from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional, Union

from sentry.api.serializers import Serializer, register, serialize
from sentry.auth.provider import Provider
from sentry.identity import is_login_provider
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


def supports_login(identity: Identity) -> bool:
    return is_login_provider(identity.idp.type)


@dataclass(eq=True, frozen=True)
class UserIdentityProvider:
    key: str
    name: str

    @classmethod
    def adapt(cls, provider: Provider) -> "UserIdentityProvider":
        return cls(provider.key, provider.name)


@dataclass(eq=True, frozen=True)
class UserIdentityConfig:
    category: str
    id: int
    provider: UserIdentityProvider
    status: Status
    is_login: bool
    organization: Optional[Organization]
    date_added: Optional[datetime]

    @staticmethod
    def wrap(identity: IdentityType, status: Status) -> "UserIdentityConfig":
        if isinstance(identity, UserSocialAuth):
            provider = UserIdentityProvider(
                identity.provider, user_social_auth.get_provider_label(identity)
            )
            is_login = False
            organization = None
        elif isinstance(identity, Identity):
            provider = UserIdentityProvider.adapt(identity.get_provider())
            is_login = supports_login(identity)
            organization = None
        elif isinstance(identity, AuthIdentity):
            provider = UserIdentityProvider.adapt(identity.auth_provider.get_provider())
            is_login = True
            organization = identity.auth_provider.organization
        else:
            raise TypeError

        category_key = _IDENTITY_CATEGORY_KEYS[type(identity)]
        date_added = identity.date_added if hasattr(identity, "date_added") else None
        return UserIdentityConfig(
            category_key, identity.id, provider, status, is_login, organization, date_added
        )

    def get_model_type_for_category(self) -> type:
        return _IDENTITY_CATEGORIES_BY_KEY[self.category]


@register(UserIdentityConfig)
class UserIdentityConfigSerializer(Serializer):
    def serialize(self, obj: UserIdentityConfig, attrs, user):
        return {
            "category": obj.category,
            "id": str(obj.id),
            "provider": {"key": obj.provider.key, "name": obj.provider.name},
            "status": obj.status.value,
            "isLogin": obj.is_login,
            "organization": serialize(obj.organization),
            "dateAdded": serialize(obj.date_added),
        }
