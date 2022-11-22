from __future__ import annotations

import abc
import contextlib
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, Generator, List, Mapping, Type

from django.contrib.auth.models import AnonymousUser

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.organization import ApiOrganizationMember
from sentry.services.hybrid_cloud.user import APIUser
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models import OrganizationMember


class AuthService(InterfaceWithLifecycle):
    @abc.abstractmethod
    def authenticate(self, *, request: AuthenticationRequest) -> AuthenticationResponse:
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
        request.user = self.user or AnonymousUser()
        request.auth = self.auth

        yield

        if has_user:
            request.user = old_user
        else:
            delattr(request, "user")

        if has_auth:
            request.auth = old_auth
        else:
            delattr(request, "auth")


@dataclass
class AuthenticationResponse(AuthenticationContext):
    expired: bool = False
    user_from_signed_request: bool = False


auth_service: AuthService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.CONTROL: impl_with_db,  # This eventually must become a DatabaseBackedAuthService, but use the new org member mapping table
        SiloMode.REGION: stubbed(
            impl_with_db, SiloMode.CONTROL
        ),  # this must eventually be purely RPC
    }
)
