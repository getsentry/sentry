from __future__ import annotations

from typing import Any, Protocol, TypeIs

from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest
from rest_framework.exceptions import NotAuthenticated
from rest_framework.request import Request

from sentry.api.exceptions import UserRequired
from sentry.auth.services.auth.model import AuthenticatedToken
from sentry.types.superuser import to_viewer_context_superuser
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.auth import is_user_from_viewer_context
from sentry.viewer_context import Actor, ActorType, set_viewer_context_actor


class RequestPrincipal(Protocol):
    """
    Whoever is calling, as it sits on ``request.user``: a user, an agent acting for one,
    a service account, or nobody.

    ``acting_user_id(principal)`` is the user behind the caller, or None when there isn't
    one. Use it instead of ``id``, which is only a user id for users. What the caller may
    do comes from ``request.access``.
    """

    @property
    def is_authenticated(self) -> bool: ...

    @property
    def is_anonymous(self) -> bool: ...

    @property
    def is_active(self) -> bool: ...

    @property
    def is_staff(self) -> bool: ...

    @property
    def is_superuser(self) -> bool: ...

    @property
    def is_sentry_app(self) -> bool | None: ...

    def get_display_name(self) -> str: ...


def has_user(principal: RequestPrincipal) -> TypeIs[User | RpcUser]:
    """Whether a user is behind the caller: the user, or an agent acting for one."""
    return isinstance(principal, (User, RpcUser))


def acting_user_id(principal: RequestPrincipal) -> int | None:
    """The user behind the caller: the user, or the one an agent acts for. None otherwise."""
    return principal.id if has_user(principal) else None


def resolve_actor(user: Any, auth: Any) -> Actor | None:
    """The actor behind an authenticated ``(user, auth)`` pair, or None if there is none."""
    # circular: imported at app setup
    from sentry.seer.agent_token import is_agent_auth
    from sentry.service_accounts.auth import is_service_account_auth

    superuser = (
        to_viewer_context_superuser(auth.superuser)
        if isinstance(auth, AuthenticatedToken)
        else None
    )
    if is_agent_auth(auth):
        return Actor(type=ActorType.AGENT, delegated_user_id=auth.user_id, superuser=superuser)
    if is_service_account_auth(auth):
        return Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=auth.entity_id)
    user_id = acting_user_id(user)
    if user_id is not None:
        return Actor(type=ActorType.USER, actor_id=user_id, superuser=superuser)
    return None


def require_user(request: HttpRequest | Request) -> User:
    """
    The user behind the caller, for code that only works for one.

    Raises ``NotAuthenticated`` for anonymous callers and ``UserRequired`` (403) for
    callers with no user behind them, e.g. service accounts. For a whole endpoint, set
    ``requires_user`` instead.
    """
    user = request.user
    if not has_user(user):
        principal: RequestPrincipal = user
        raise UserRequired() if principal.is_authenticated else NotAuthenticated()
    return user


def set_request_principal(request: HttpRequest | Request, user: Any, auth: Any) -> None:
    """
    Set ``request.user`` and ``request.auth``.

    The only place they're set, so what lands on ``request.user`` is decided here.
    """
    from sentry.service_accounts.auth import is_service_account_auth

    # A service account is set only on a DRF Request, whose setter also copies it to Django's
    # request.user. Until DRF authenticates it, Django's request.user is anonymous, and session
    # auth never sees it: ViewerContextAuthentication runs before SessionAuthentication.
    # Checked on the credential: isinstance on Django's lazy user would load the session.
    if is_service_account_auth(auth) and not isinstance(request, Request):
        user = AnonymousUser()
    request.user = user
    request.auth = auth


_drf_authenticate = vars(Request)["_authenticate"]


def _authenticate(self: Request) -> None:
    # DRF sets the authenticator's result itself; route it through the chokepoint.
    _drf_authenticate(self)
    set_request_principal(self, self.user, self.auth)
    # Endpoints with their own authentication classes run them after the viewer-context
    # middleware, so update the caller it recorded. A credential with no caller of its own,
    # e.g. a signed service call, keeps the one from the viewer-context header.
    # A user loaded from a signed viewer context keeps its actor too, e.g. an agent.
    if is_user_from_viewer_context(self):
        return
    if (actor := resolve_actor(self.user, self.auth)) is not None:
        set_viewer_context_actor(actor)


def _anonymous_display_name(self: AnonymousUser) -> str:
    return ""


def patch_request_principal() -> None:
    """
    Route DRF authentication through ``set_request_principal`` and give Django's
    ``AnonymousUser`` the ``RequestPrincipal`` interface.

    Patched rather than subclassed because Django, DRF and our own code construct these
    in many places. ``tools/mypy_helpers/plugin.py`` declares the same members.
    """
    Request._authenticate = _authenticate  # type: ignore[attr-defined]
    AnonymousUser.is_sentry_app = False
    AnonymousUser.get_display_name = _anonymous_display_name  # type: ignore[method-assign]
