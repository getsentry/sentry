from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional, Union

import sentry.integrations
from sentry.api.serializers import Serializer, register, serialize
from sentry.auth.provider import Provider
from sentry.exceptions import NotRegistered
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
    name: str
    status: Status
    is_login: bool
    organization: Optional[Organization] = None
    date_added: Optional[datetime] = None
    date_verified: Optional[datetime] = None
    date_synced: Optional[datetime] = None

    @classmethod
    def wrap(cls, identity: IdentityType, status: Status) -> "UserIdentityConfig":
        def base(**kwargs):
            return cls(
                category=_IDENTITY_CATEGORY_KEYS[type(identity)],
                id=identity.id,
                status=status,
                **kwargs,
            )

        if isinstance(identity, UserSocialAuth):
            return base(
                provider=UserIdentityProvider(
                    identity.provider, user_social_auth.get_provider_label(identity)
                ),
                name=identity.uid,
                is_login=False,
            )
        elif isinstance(identity, Identity):
            try:
                provider = identity.get_provider()
            except NotRegistered:
                provider = sentry.integrations.get(identity.idp.type)

            return base(
                provider=UserIdentityProvider.adapt(provider),
                name=identity.external_id,
                is_login=supports_login(identity),
                date_added=identity.date_added,
                date_verified=identity.date_verified,
            )
        elif isinstance(identity, AuthIdentity):
            return base(
                provider=UserIdentityProvider.adapt(identity.auth_provider.get_provider()),
                name=identity.ident,
                is_login=True,
                organization=identity.auth_provider.organization,
                date_added=identity.date_added,
                date_verified=identity.last_verified,
                date_synced=identity.last_synced,
            )
        else:
            raise TypeError

    def get_model_type_for_category(self) -> type:
        return _IDENTITY_CATEGORIES_BY_KEY[self.category]


@register(UserIdentityConfig)
class UserIdentityConfigSerializer(Serializer):
    def serialize(self, obj: UserIdentityConfig, attrs, user):
        return {
            "category": obj.category,
            "id": str(obj.id),
            "provider": {"key": obj.provider.key, "name": obj.provider.name},
            "name": obj.name,
            "status": obj.status.value,
            "isLogin": obj.is_login,
            "organization": serialize(obj.organization),
            "dateAdded": serialize(obj.date_added),
            "dateVerified": serialize(obj.date_verified),
            "dateSynced": serialize(obj.date_synced),
        }
