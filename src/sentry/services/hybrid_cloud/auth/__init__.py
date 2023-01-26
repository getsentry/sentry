from __future__ import annotations

import abc
import base64
import contextlib
from dataclasses import dataclass, field
from enum import IntEnum
from typing import TYPE_CHECKING, Any, Dict, Generator, List, Mapping, Tuple, Type

from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication
from rest_framework.request import Request

from sentry.api.authentication import ApiKeyAuthentication, TokenAuthentication
from sentry.relay.utils import get_header_relay_id, get_header_relay_signature
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.organization import ApiOrganization, ApiOrganizationMember
from sentry.services.hybrid_cloud.user import APIUser
from sentry.silo import SiloMode
from sentry.utils.linksign import find_signature

if TYPE_CHECKING:
    from sentry.models import OrganizationMember


class ApiAuthenticatorType(IntEnum):
    API_KEY_AUTHENTICATION = 0
    TOKEN_AUTHENTICATION = 1
    SESSION_AUTHENTICATION = 2

    @classmethod
    def from_authenticator(self, auth: Type[BaseAuthentication]) -> ApiAuthenticatorType | None:
        if auth == ApiKeyAuthentication:
            return ApiAuthenticatorType.API_KEY_AUTHENTICATION
        if auth == TokenAuthentication:
            return ApiAuthenticatorType.TOKEN_AUTHENTICATION
        return None

    def as_authenticator(self) -> BaseAuthentication:
        if self == self.API_KEY_AUTHENTICATION:
            return ApiKeyAuthentication()
        if self == self.TOKEN_AUTHENTICATION:
            return TokenAuthentication()
        else:
            raise ValueError(f"{self!r} has not authenticator associated with it.")


def authentication_request_from(request: Request) -> AuthenticationRequest:
    return AuthenticationRequest(
        sentry_relay_id=get_header_relay_id(request),
        sentry_relay_signature=get_header_relay_signature(request),
        backend=request.session.get("_auth_user_backend", None),
        user_id=request.session.get("_auth_user_id", None),
        user_hash=request.session.get("_auth_user_hash", None),
        nonce=request.session.get("_nonce", None),
        remote_addr=request.META["REMOTE_ADDR"],
        signature=find_signature(request),
        absolute_url=request.build_absolute_uri(),
        path=request.path,
        authorization_b64=_normalize_to_b64(request.META.get("HTTP_AUTHORIZATION")),
    )


def _normalize_to_b64(input: str | bytes | None) -> str | None:
    if input is None:
        return None
    if isinstance(input, str):
        input = input.encode("utf8")
    return base64.b64encode(input).decode("utf8")


class ApiAuthentication(BaseAuthentication):  # type: ignore
    types: List[ApiAuthenticatorType]

    def __init__(self, types: List[ApiAuthenticatorType]):
        self.types = types

    def authenticate(self, request: Request) -> Tuple[Any, Any] | None:
        response = auth_service.authenticate_with(
            request=authentication_request_from(request), authenticator_types=self.types
        )

        if response.user is not None:
            return response.user, response.auth

        return None


class AuthService(InterfaceWithLifecycle):
    @abc.abstractmethod
    def authenticate(self, *, request: AuthenticationRequest) -> MiddlewareAuthenticationResponse:
        pass

    @abc.abstractmethod
    def authenticate_with(
        self, *, request: AuthenticationRequest, authenticator_types: List[ApiAuthenticatorType]
    ) -> AuthenticationContext:
        pass

    @abc.abstractmethod
    def get_org_auth_config(
        self, *, organization_ids: List[int]
    ) -> List[ApiOrganizationAuthConfig]:
        pass

    @abc.abstractmethod
    def get_user_auth_state(
        self,
        *,
        user_id: int,
        is_superuser: bool,
        organization_id: int | None,
        org_member: ApiOrganizationMember | OrganizationMember | None,
    ) -> ApiAuthState:
        pass

    # TODO: Denormalize this scim enabled flag onto organizations?
    # This is potentially a large list
    @abc.abstractmethod
    def get_org_ids_with_scim(
        self,
    ) -> List[int]:
        """
        This method returns a list of org ids that have scim enabled
        :return:
        """
        pass

    @abc.abstractmethod
    def get_auth_providers(self, organization_id: int) -> List[ApiAuthProvider]:
        """
        This method returns a list of auth providers for an org
        :return:
        """
        pass

    @abc.abstractmethod
    def handle_new_membership(
        self,
        request: Request,
        organization: ApiOrganization,
        auth_identity: ApiAuthIdentity,
        auth_provider: ApiAuthProvider,
    ) -> Tuple[APIUser, ApiOrganizationMember]:
        pass


def impl_with_db() -> AuthService:
    from sentry.services.hybrid_cloud.auth.impl import DatabaseBackedAuthService

    return DatabaseBackedAuthService()


@dataclass
class ApiAuthState:
    sso_state: ApiMemberSsoState
    permissions: List[str]


@dataclass(eq=True)
class ApiMemberSsoState:
    is_required: bool = False
    is_valid: bool = False


@dataclass
class AuthenticationRequest:
    # HTTP_X_SENTRY_RELAY_ID
    sentry_relay_id: str | None = None
    # HTTP_X_SENTRY_RELAY_SIGNATURE
    sentry_relay_signature: str | None = None
    backend: str | None = None
    user_id: str | None = None
    user_hash: str | None = None
    nonce: str | None = None
    remote_addr: str | None = None
    signature: str | None = None
    absolute_url: str = ""
    path: str = ""
    authorization_b64: str | None = None


@dataclass(eq=True)
class AuthenticatedToken:
    entity_id: int | None = None
    kind: str = "system"
    user_id: int | None = None  # only relevant for ApiToken
    organization_id: int | None = None
    allowed_origins: List[str] = field(default_factory=list)
    audit_log_data: Dict[str, Any] = field(default_factory=dict)
    scopes: List[str] = field(default_factory=list)

    @classmethod
    def from_token(cls, token: Any) -> AuthenticatedToken | None:
        if token is None:
            return None

        if isinstance(token, AuthenticatedToken):
            return token

        for kind, kind_cls in cls.get_kinds().items():
            if isinstance(token, kind_cls):
                break
        else:
            raise KeyError(f"Token {token} is a not a registered AuthenticatedToken type!")

        return cls(
            entity_id=getattr(token, "id", None),
            kind=kind,
            user_id=getattr(token, "user_id", None),
            organization_id=getattr(token, "organization_id", None),
            allowed_origins=token.get_allowed_origins(),
            audit_log_data=token.get_audit_log_data(),
            scopes=token.get_scopes(),
        )

    @classmethod
    def get_kinds(cls) -> Mapping[str, Type[Any]]:
        return getattr(cls, "_kinds", {})

    @classmethod
    def register_kind(cls, kind_name: str, t: Type[Any]) -> None:
        kind_map = getattr(cls, "_kinds", {})
        if kind_name in kind_map:
            raise ValueError(f"Conflict detected, kind {kind_name} registered twice!")
        kind_map[kind_name] = t
        setattr(cls, "_kinds", kind_map)

    def get_audit_log_data(self) -> Mapping[str, Any]:
        return self.audit_log_data

    def get_allowed_origins(self) -> List[str]:
        return self.allowed_origins

    def get_scopes(self) -> list[str]:
        return self.scopes

    def has_scope(self, scope: str) -> bool:
        if self.kind == "system":
            return True
        return scope in self.get_scopes()


@dataclass
class AuthenticationContext:
    """
    The default of all values should be a valid, non authenticated context.
    """

    auth: AuthenticatedToken | None = None
    user: APIUser | None = None

    def _get_user(self) -> APIUser | AnonymousUser:
        """
        Helper function to avoid importing AnonymousUser when `applied_to_request` is run on startup
        """
        from django.contrib.auth.models import AnonymousUser

        return self.user or AnonymousUser()

    @contextlib.contextmanager
    def applied_to_request(self, request: Any = None) -> Generator[None, None, None]:
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
            yield
            return

        has_user = hasattr(request, "user")
        has_auth = hasattr(request, "auth")

        old_user = getattr(request, "user", None)
        old_auth = getattr(request, "auth", None)
        request.user = self._get_user()
        request.auth = self.auth

        try:
            yield
        finally:
            if has_user:
                request.user = old_user
            else:
                delattr(request, "user")

            if has_auth:
                request.auth = old_auth
            else:
                delattr(request, "auth")


@dataclass
class MiddlewareAuthenticationResponse(AuthenticationContext):
    expired: bool = False
    user_from_signed_request: bool = False


@dataclass(eq=True, frozen=True)
class ApiAuthProviderFlags:
    allow_unlinked: bool = False
    scim_enabled: bool = False


@dataclass(eq=True, frozen=True)
class ApiAuthProvider:
    id: int = -1
    organization_id: int = -1
    provider: str = ""
    flags: ApiAuthProviderFlags = field(default_factory=lambda: ApiAuthProviderFlags())


@dataclass
class ApiAuthIdentity:
    id: int = -1
    user_id: int = -1
    provider_id: int = -1
    ident: str = ""


@dataclass(eq=True)
class ApiOrganizationAuthConfig:
    organization_id: int = -1
    auth_provider: ApiAuthProvider | None = None
    has_api_key: bool = False


auth_service: AuthService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.CONTROL: impl_with_db,  # This eventually must become a DatabaseBackedAuthService, but use the new org member mapping table
        SiloMode.REGION: stubbed(
            impl_with_db, SiloMode.CONTROL
        ),  # this must eventually be purely RPC
    }
)
