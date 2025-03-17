from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, TypedDict, Union

from django.contrib.auth.models import AnonymousUser
from django.db.models.base import Model

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.user_social_auth import get_provider_label
from sentry.exceptions import NotRegistered
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.identity import is_login_provider
from sentry.integrations.manager import default_manager as integrations
from sentry.models.authidentity import AuthIdentity
from sentry.pipeline.provider import PipelineProvider
from sentry.users.models.identity import Identity
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from social_auth.models import UserSocialAuth

if TYPE_CHECKING:
    from sentry.api.serializers.models.organization import ControlSiloOrganizationSerializerResponse


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
    def adapt(cls, provider: PipelineProvider) -> UserIdentityProvider:
        return cls(provider.key, provider.name)


class UserIdentityProviderSerializerResponse(TypedDict):
    key: str
    name: str


@dataclass(eq=True, frozen=True)
class UserIdentityConfig:
    category: str
    id: int
    provider: UserIdentityProvider
    name: str
    status: Status
    is_login: bool
    organization_id: int | None = None
    date_added: datetime | None = None
    date_verified: datetime | None = None
    date_synced: datetime | None = None

    @classmethod
    def wrap(cls, identity: IdentityType, status: Status) -> UserIdentityConfig:
        provider: PipelineProvider

        def base(**kwargs: Any) -> UserIdentityConfig:
            return cls(
                category=_IDENTITY_CATEGORY_KEYS[type(identity)],
                id=identity.id,
                status=status,
                **kwargs,
            )

        if isinstance(identity, UserSocialAuth):
            return base(
                provider=UserIdentityProvider(identity.provider, get_provider_label(identity)),
                name=identity.uid,
                is_login=False,
            )
        elif isinstance(identity, Identity):
            try:
                provider = identity.get_provider()
            except NotRegistered:
                provider = integrations.get(identity.idp.type)

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
                organization_id=identity.auth_provider.organization_id,
                date_added=identity.date_added,
                date_verified=identity.last_verified,
                date_synced=identity.last_synced,
            )
        else:
            raise TypeError

    def get_model_type_for_category(self) -> type[Model]:
        return _IDENTITY_CATEGORIES_BY_KEY[self.category]


class UserIdentityConfigSerializerResponse(TypedDict):
    id: str
    category: str
    provider: UserIdentityProviderSerializerResponse
    name: str
    status: str
    isLogin: bool
    organization: ControlSiloOrganizationSerializerResponse
    dateAdded: datetime | None
    dateVerified: datetime | None
    dateSynced: datetime | None


@register(UserIdentityConfig)
class UserIdentityConfigSerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[UserIdentityConfig],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[Any, Any]:
        result: MutableMapping[UserIdentityConfig, Any] = {}
        organizations = {
            o.id: o
            for o in organization_mapping_service.get_many(
                organization_ids=[i.organization_id for i in item_list]
            )
        }
        for item in item_list:
            # check if org_id exists bc mypy gets unhappy if .get() is given a None type
            result[item] = (
                dict(organization=organizations.get(item.organization_id))
                if item.organization_id
                else dict(organization=None)
            )

        return result

    def serialize(
        self,
        obj: UserIdentityConfig,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> UserIdentityConfigSerializerResponse:
        from sentry.api.serializers.models.organization import ControlSiloOrganizationSerializer

        return {
            "category": obj.category,
            "id": str(obj.id),
            "provider": {"key": obj.provider.key, "name": obj.provider.name},
            "name": obj.name,
            "status": obj.status.value,
            "isLogin": obj.is_login,
            "organization": serialize(
                attrs["organization"],
                serializer=ControlSiloOrganizationSerializer(),
            ),
            "dateAdded": serialize(obj.date_added),
            "dateVerified": serialize(obj.date_verified),
            "dateSynced": serialize(obj.date_synced),
        }
