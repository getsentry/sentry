# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import contextlib
import datetime
from collections.abc import Collection, Generator, Mapping
from typing import TYPE_CHECKING, Any, Optional, Union

from pydantic.fields import Field

from sentry.hybridcloud.rpc import RpcModel
from sentry.users.services.user import RpcUser

if TYPE_CHECKING:
    from django.contrib.auth.models import AnonymousUser

    from sentry.auth.provider import Provider


class RpcApiKey(RpcModel):
    id: int = -1
    organization_id: int = -1
    key: str = ""
    status: int = 0
    allowed_origins: list[str] = Field(default_factory=list)
    label: str = ""
    scope_list: list[str] = Field(default_factory=list)


class RpcApiToken(RpcModel):
    id: int = -1
    user_id: int = -1
    organization_id: int | None = None
    application_id: int | None = None
    application_is_active: bool = False
    token: str = ""
    hashed_token: str | None = None
    expires_at: datetime.datetime | None = None
    allowed_origins: list[str] = Field(default_factory=list)
    scope_list: list[str] = Field(default_factory=list)
    scoping_organization_id: int | None = None


class RpcMemberSsoState(RpcModel):
    is_required: bool = False
    is_valid: bool = False


class RpcAuthState(RpcModel):
    sso_state: RpcMemberSsoState
    permissions: list[str]


class AuthenticatedToken(RpcModel):
    allowed_origins: list[str] = Field(default_factory=list)
    audit_log_data: dict[str, Any] = Field(default_factory=dict)
    scopes: list[str] = Field(default_factory=list)
    entity_id: int | None = None
    kind: str = "system"
    user_id: int | None = None  # only relevant for ApiToken
    organization_id: int | None = None
    application_id: int | None = None  # only relevant for ApiToken

    def token_has_org_access(self, organization_id: int) -> bool:
        return self.kind == "api_token" and self.organization_id == organization_id

    @classmethod
    def kinds(cls) -> Mapping[str, Collection[type[Any]]]:
        from sentry.auth.system import SystemToken
        from sentry.hybridcloud.models import ApiKeyReplica, ApiTokenReplica, OrgAuthTokenReplica
        from sentry.models.apikey import ApiKey
        from sentry.models.apitoken import ApiToken
        from sentry.models.orgauthtoken import OrgAuthToken

        return {
            "system": frozenset([SystemToken]),
            "api_token": frozenset([ApiToken, ApiTokenReplica]),
            "org_auth_token": frozenset([OrgAuthToken, OrgAuthTokenReplica]),
            "api_key": frozenset([ApiKey, ApiKeyReplica]),
        }

    @classmethod
    def from_token(cls, token: Any) -> Optional["AuthenticatedToken"]:
        if token is None:
            return None

        if isinstance(token, AuthenticatedToken):
            return token

        for kind, types in cls.kinds().items():
            if any(isinstance(token, kind_cls) for kind_cls in types):
                break
        else:
            raise KeyError(f"Token {token} is a not a registered AuthenticatedToken type!")

        entity_id: int | None = None
        # System tokens have a string id but don't really represent a true entity
        if kind != "system":
            entity_id = getattr(token, "entity_id", getattr(token, "id", None))

        return cls(
            allowed_origins=token.get_allowed_origins(),
            scopes=token.get_scopes(),
            audit_log_data=token.get_audit_log_data(),
            entity_id=entity_id,
            kind=kind,
            user_id=getattr(token, "user_id", None),
            organization_id=getattr(token, "organization_id", None),
            application_id=getattr(token, "application_id", None),
        )

    def get_audit_log_data(self) -> Mapping[str, Any]:
        return self.audit_log_data

    def get_allowed_origins(self) -> list[str]:
        return self.allowed_origins

    def get_scopes(self) -> list[str]:
        return self.scopes

    def has_scope(self, scope: str) -> bool:
        if self.kind == "system":
            return True
        return scope in self.get_scopes()


class AuthenticationContext(RpcModel):
    """
    The default of all values should be a valid, non authenticated context.
    """

    auth: AuthenticatedToken | None = None
    user: RpcUser | None = None

    def _get_user(self) -> Union[RpcUser, "AnonymousUser"]:
        """
        Helper function to avoid importing AnonymousUser when `applied_to_request` is run on startup
        """
        from django.contrib.auth.models import AnonymousUser

        return self.user or AnonymousUser()

    @contextlib.contextmanager
    def applied_to_request(self, request: Any = None) -> Generator[Any, None, None]:
        """
        Some code still reaches for the global 'env' object when determining user or auth behaviors.  This bleeds the
        current request context into that code, but makes it difficult to carry RPC authentication context in an
        isolated, controlled way.  This method allows for a context handling an RPC or inter silo behavior to assume
        the correct user and auth context provided explicitly in a context.
        """
        from sentry.app import env

        if request is None:
            request = env.request

        if request is None:
            # Contexts that lack a request
            # Note -- if a request is setup in the env after this context manager, you run the risk of bugs.
            yield request
            return

        has_user = hasattr(request, "user")
        has_auth = hasattr(request, "auth")

        old_user = getattr(request, "user", None)
        old_auth = getattr(request, "auth", None)
        request.user = self._get_user()
        request.auth = self.auth

        try:
            yield request
        finally:
            if has_user:
                request.user = old_user
            else:
                delattr(request, "user")

            if has_auth:
                request.auth = old_auth
            else:
                delattr(request, "auth")


class RpcAuthProviderFlags(RpcModel):
    allow_unlinked: bool = False
    scim_enabled: bool = False


class RpcAuthProvider(RpcModel):
    id: int = -1
    organization_id: int = -1
    provider: str = ""
    flags: RpcAuthProviderFlags = Field(default_factory=lambda: RpcAuthProviderFlags())
    config: dict[str, Any]
    default_role: int = -1
    default_global_access: bool = False

    def __hash__(self) -> int:
        return hash((self.id, self.organization_id, self.provider))

    def get_audit_log_data(self) -> dict[str, Any]:
        provider = self.provider
        # NOTE(isabella): for both standard fly SSO and fly-non-partner SSO, we should record the
        # provider as "fly" in the audit log entry data; the only difference between the two is
        # that the latter can be disabled by customers
        if "fly" in self.provider:
            provider = "fly"
        return {"provider": provider, "config": self.config}

    def get_provider(self) -> "Provider":
        from sentry.auth import manager

        return manager.get(self.provider, **self.config)

    def get_scim_token(self) -> str | None:
        from sentry.models.authprovider import get_scim_token

        return get_scim_token(self.flags.scim_enabled, self.organization_id, self.provider)


class RpcAuthIdentity(RpcModel):
    id: int = -1
    user_id: int = -1
    auth_provider_id: int = -1
    ident: str = ""
    data: dict[str, Any] = Field(default_factory=dict)
    last_verified: datetime.datetime = Field(default_factory=datetime.datetime.now)


class RpcOrganizationAuthConfig(RpcModel):
    organization_id: int = -1
    auth_provider: RpcAuthProvider | None = None
    has_api_key: bool = False
