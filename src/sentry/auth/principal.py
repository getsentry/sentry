from __future__ import annotations

from typing import Any, Protocol

from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest
from rest_framework.request import Request

from sentry.auth.services.auth.model import AuthenticatedToken
from sentry.types.superuser import to_viewer_context_superuser
from sentry.viewer_context import Actor, ActorType, get_viewer_context, set_viewer_context_actor


class RequestPrincipal(Protocol):
    """
    Whoever is calling, as it sits on ``request.user``: a user, an agent acting for one,
    a service account, or nobody.

    ``user_id`` is the human behind the caller, or None when there isn't one. Read it
    instead of ``id``, which is only a user id for humans. What the caller may do comes
    from ``request.access``.
    """

    @property
    def user_id(self) -> int | None: ...

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


def resolve_actor(user: Any, auth: Any) -> Actor | None:
    """The actor behind an authenticated ``(user, auth)`` pair, or None if there is none."""
    from sentry.seer.agent_token import is_agent_auth  # circular: imported at app setup

    superuser = (
        to_viewer_context_superuser(auth.superuser)
        if isinstance(auth, AuthenticatedToken)
        else None
    )
    if is_agent_auth(auth):
        return Actor(type=ActorType.AGENT, delegated_user_id=auth.user_id, superuser=superuser)
    user_id = getattr(user, "user_id", None)
    if user_id is not None:
        return Actor(type=ActorType.USER, actor_id=user_id, superuser=superuser)
    return None


def get_current_actor() -> Actor | None:
    """
    The caller in the current viewer context, or None if there is no known caller.

    Use it to tell kinds of callers apart (agent, service account) or to record who did
    something. It is also set in tasks and RPCs the request propagates to.
    """
    ctx = get_viewer_context()
    if ctx is None or ctx.actor.type == ActorType.UNKNOWN:
        return None
    return ctx.actor


def set_request_principal(request: HttpRequest | Request, user: Any, auth: Any) -> None:
    """
    Set ``request.user`` and ``request.auth``.

    The only place they're set, so what lands on ``request.user`` is decided here.
    """
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
    AnonymousUser.user_id = None
    AnonymousUser.is_sentry_app = False
    AnonymousUser.get_display_name = _anonymous_display_name  # type: ignore[method-assign]
