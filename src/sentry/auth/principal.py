from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Any, TypeAlias

from rest_framework.exceptions import PermissionDenied

if TYPE_CHECKING:
    from django.http import HttpRequest
    from rest_framework.request import Request

    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser


class PrincipalKind(StrEnum):
    USER = "user"
    SERVICE_ACCOUNT = "service_account"


@dataclass(frozen=True)
class AuthenticatedUserPrincipal:
    id: int
    display_name: str
    kind = PrincipalKind.USER

    @classmethod
    def from_user(cls, user: User | RpcUser) -> AuthenticatedUserPrincipal:
        user_object: Any = user
        display_name = getattr(user_object, "display_name", None)
        if display_name is None:
            display_name = user_object.get_display_name()
        return cls(id=user.id, display_name=display_name)

    @property
    def organization_id(self) -> None:
        return None

    @property
    def identifier(self) -> str:
        return f"{self.kind.value}:{self.id}"


@dataclass(frozen=True)
class AuthenticatedServiceAccountPrincipal:
    id: int
    organization_id: int
    display_name: str
    kind = PrincipalKind.SERVICE_ACCOUNT

    @property
    def identifier(self) -> str:
        return f"{self.kind.value}:{self.id}"


AuthenticatedPrincipal: TypeAlias = (
    AuthenticatedUserPrincipal | AuthenticatedServiceAccountPrincipal
)

_REQUEST_PRINCIPAL_ATTRIBUTE = "_sentry_authenticated_principal"


def set_authenticated_principal(
    request: HttpRequest | Request, principal: AuthenticatedPrincipal
) -> None:
    setattr(request, _REQUEST_PRINCIPAL_ATTRIBUTE, principal)


def get_authenticated_principal(request: HttpRequest | Request) -> AuthenticatedPrincipal | None:
    principal = getattr(request, _REQUEST_PRINCIPAL_ATTRIBUTE, None)
    if principal is not None:
        return principal

    user = request.user
    if user.is_authenticated:
        return AuthenticatedUserPrincipal.from_user(user)
    return None


def require_service_account_principal(
    request: HttpRequest | Request,
) -> AuthenticatedServiceAccountPrincipal:
    principal = get_authenticated_principal(request)
    if not isinstance(principal, AuthenticatedServiceAccountPrincipal):
        raise PermissionDenied("This operation requires a service account.")
    return principal


def require_user_principal(request: HttpRequest | Request) -> AuthenticatedUserPrincipal:
    principal = get_authenticated_principal(request)
    if not isinstance(principal, AuthenticatedUserPrincipal):
        raise PermissionDenied("This operation requires a user.")
    return principal
