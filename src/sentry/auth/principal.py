from __future__ import annotations

from typing import Any, Protocol, TypeIs

from django.contrib.auth.models import AnonymousUser

from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.viewer_context import Actor, ActorType


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
    from sentry.seer.agent_token import is_agent_auth  # circular: imported at app setup

    if is_agent_auth(auth):
        return Actor(type=ActorType.AGENT, delegated_user_id=auth.user_id)
    user_id = acting_user_id(user)
    if user_id is not None:
        return Actor(type=ActorType.USER, actor_id=user_id)
    return None


def _anonymous_display_name(self: AnonymousUser) -> str:
    return ""


def patch_request_principal() -> None:
    """
    Give Django's ``AnonymousUser`` the ``RequestPrincipal`` interface.

    Patched rather than subclassed because Django, DRF and our own code construct it in
    many places. ``tools/mypy_helpers/plugin.py`` declares the same members.
    """
    AnonymousUser.is_sentry_app = False
    AnonymousUser.get_display_name = _anonymous_display_name  # type: ignore[method-assign]
