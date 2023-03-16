# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
import base64
import contextlib
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any, Dict, Generator, List, Mapping, Optional, Tuple, Type, Union

from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication
from rest_framework.request import Request

from sentry.api.authentication import ApiKeyAuthentication, TokenAuthentication
from sentry.relay.utils import get_header_relay_id, get_header_relay_signature
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.organization import (
    RpcOrganization,
    RpcOrganizationMember,
    RpcOrganizationMemberSummary,
)
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode
from sentry.utils.linksign import find_signature


class RpcAuthenticatorType(IntEnum):
    API_KEY_AUTHENTICATION = 0
    TOKEN_AUTHENTICATION = 1
    SESSION_AUTHENTICATION = 2

    @classmethod
    def from_authenticator(
        self, auth: Type[BaseAuthentication]
    ) -> Optional["RpcAuthenticatorType"]:
        if auth == ApiKeyAuthentication:
            return RpcAuthenticatorType.API_KEY_AUTHENTICATION
        if auth == TokenAuthentication:
            return RpcAuthenticatorType.TOKEN_AUTHENTICATION
        return None

    def as_authenticator(self) -> BaseAuthentication:
        if self == self.API_KEY_AUTHENTICATION:
            return ApiKeyAuthentication()
        if self == self.TOKEN_AUTHENTICATION:
            return TokenAuthentication()
        else:
            raise ValueError(f"{self!r} has not authenticator associated with it.")


def _normalize_to_b64(input: Optional[Union[str, bytes]]) -> Optional[str]:
    if input is None:
        return None
    if isinstance(input, str):
        input = input.encode("utf8")
    return base64.b64encode(input).decode("utf8")


class RpcAuthentication(BaseAuthentication):  # type: ignore
    www_authenticate_realm = "api"
    types: List[RpcAuthenticatorType]

    def __init__(self, types: List[RpcAuthenticatorType]):
        self.types = types

    def authenticate(self, request: Request) -> Optional[Tuple[Any, Any]]:
        response = auth_service.authenticate_with(
            request=authentication_request_from(request), authenticator_types=self.types
        )

        if response.user is not None:
            return response.user, response.auth

        return None

    # What does this do you may ask?  Actually, it tricks the django request_framework to returning the correct 401
    # over 403 in unauthenticated cases, due to some deep library code nonsense.  Tests fail if you remove.
    # Otherwise, this authenticate header value means absolutely nothing to clients.
    def authenticate_header(self, request: Request) -> str:
        return 'xBasic realm="%s"' % self.www_authenticate_realm


@dataclass(eq=True)
class RpcMemberSsoState:
    is_required: bool = False
    is_valid: bool = False


@dataclass
class RpcAuthState:
    sso_state: RpcMemberSsoState
    permissions: List[str]


@dataclass
class AuthenticationRequest:
    # HTTP_X_SENTRY_RELAY_ID
    sentry_relay_id: Optional[str] = None
    # HTTP_X_SENTRY_RELAY_SIGNATURE
    sentry_relay_signature: Optional[str] = None
    backend: Optional[str] = None
    user_id: Optional[str] = None
    user_hash: Optional[str] = None
    nonce: Optional[str] = None
    remote_addr: Optional[str] = None
    signature: Optional[str] = None
    absolute_url: str = ""
    absolute_url_root: str = ""
    path: str = ""
    authorization_b64: Optional[str] = None


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
        absolute_url_root=request.build_absolute_uri("/"),
        path=request.path,
        authorization_b64=_normalize_to_b64(request.META.get("HTTP_AUTHORIZATION")),
    )


@dataclass(eq=True)
class AuthenticatedToken:
    entity_id: Optional[int] = None
    kind: str = "system"
    user_id: Optional[int] = None  # only relevant for ApiToken
    organization_id: Optional[int] = None
    allowed_origins: List[str] = field(default_factory=list)
    audit_log_data: Dict[str, Any] = field(default_factory=dict)
    scopes: List[str] = field(default_factory=list)

    @classmethod
    def from_token(cls, token: Any) -> Optional["AuthenticatedToken"]:
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

    def get_scopes(self) -> List[str]:
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

    auth: Optional[AuthenticatedToken] = None
    user: Optional[RpcUser] = None

    def _get_user(self) -> Union[RpcUser, AnonymousUser]:
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
class RpcAuthProviderFlags:
    allow_unlinked: bool = False
    scim_enabled: bool = False


@dataclass(eq=True, frozen=True)
class RpcAuthProvider:
    id: int = -1
    organization_id: int = -1
    provider: str = ""
    flags: RpcAuthProviderFlags = field(default_factory=lambda: RpcAuthProviderFlags())


@dataclass
class RpcAuthIdentity:
    id: int = -1
    user_id: int = -1
    provider_id: int = -1
    ident: str = ""


@dataclass(eq=True)
class RpcOrganizationAuthConfig:
    organization_id: int = -1
    auth_provider: Optional[RpcAuthProvider] = None
    has_api_key: bool = False


class AuthService(InterfaceWithLifecycle):
    @abc.abstractmethod
    def authenticate(self, *, request: AuthenticationRequest) -> MiddlewareAuthenticationResponse:
        pass

    @abc.abstractmethod
    def authenticate_with(
        self, *, request: AuthenticationRequest, authenticator_types: List[RpcAuthenticatorType]
    ) -> AuthenticationContext:
        pass

    @abc.abstractmethod
    def get_org_auth_config(
        self, *, organization_ids: List[int]
    ) -> List[RpcOrganizationAuthConfig]:
        pass

    @abc.abstractmethod
    def get_user_auth_state(
        self,
        *,
        user_id: int,
        is_superuser: bool,
        organization_id: Optional[int],
        org_member: Optional[RpcOrganizationMemberSummary],
    ) -> RpcAuthState:
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
    def get_auth_providers(self, organization_id: int) -> List[RpcAuthProvider]:
        """
        This method returns a list of auth providers for an org
        :return:
        """
        pass

    @abc.abstractmethod
    def handle_new_membership(
        self,
        request: Request,
        organization: RpcOrganization,
        auth_identity: RpcAuthIdentity,
        auth_provider: RpcAuthProvider,
    ) -> Tuple[RpcUser, RpcOrganizationMember]:
        pass

    @abc.abstractmethod
    def token_has_org_access(self, *, token: AuthenticatedToken, organization_id: int) -> bool:
        pass


def impl_with_db() -> AuthService:
    from sentry.services.hybrid_cloud.auth.impl import DatabaseBackedAuthService

    return DatabaseBackedAuthService()


auth_service: AuthService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.CONTROL: impl_with_db,  # This eventually must become a DatabaseBackedAuthService, but use the new org member mapping table
        SiloMode.REGION: stubbed(
            impl_with_db, SiloMode.CONTROL
        ),  # this must eventually be purely RPC
    }
)
