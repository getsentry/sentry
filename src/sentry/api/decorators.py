from collections.abc import Callable
from functools import wraps
from typing import Concatenate

from django.contrib.auth.models import AnonymousUser
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.api.exceptions import PrimaryEmailVerificationRequired, SudoRequired, UserRequired
from sentry.auth.principal import has_user, require_user
from sentry.models.apikey import is_api_key_auth
from sentry.models.apitoken import is_api_token_auth
from sentry.models.orgauthtoken import is_org_auth_token_auth
from sentry.seer.agent_token import is_agent_auth


def is_considered_sudo(request: Request) -> bool:
    if is_agent_auth(request.auth):
        return False

    # Right now, only password reauthentication (django-sudo) is supported,
    # so if a user doesn't have a password (for example, only has github auth)
    # then we shouldn't prompt them for the password they don't have.
    return (
        request.is_sudo()
        or is_api_key_auth(request.auth)
        or is_api_token_auth(request.auth)
        or is_org_auth_token_auth(request.auth)
        or (has_user(request.user) and not request.user.has_usable_password())
    )


def require_sudo(request: Request) -> None:
    """Raise unless the request counts as sudo. A caller with no user can't re-authenticate."""
    if is_considered_sudo(request):
        return
    if not has_user(request.user):
        raise UserRequired()
    # TODO(dcramer): support some kind of auth flow to allow this
    # externally
    raise SudoRequired(request.user)


type _RFMethod[T, **P] = Callable[Concatenate[T, Request, P], HttpResponseBase]


def sudo_required[T, **P](func: _RFMethod[T, P]) -> _RFMethod[T, P]:
    @wraps(func)
    def wrapped(self: T, request: Request, *args: P.args, **kwargs: P.kwargs) -> HttpResponseBase:
        # If we are already authenticated through an API key we do not
        # care about the sudo flag.
        require_sudo(request)
        return func(self, request, *args, **kwargs)

    return wrapped


def primary_email_verification_required[T, **P](func: _RFMethod[T, P]) -> _RFMethod[T, P]:
    @wraps(func)
    def wrapped(self: T, request: Request, *args: P.args, **kwargs: P.kwargs) -> HttpResponseBase:
        if (
            isinstance(request.user, AnonymousUser)
            or not require_user(request).has_verified_primary_email()
        ):
            raise PrimaryEmailVerificationRequired(request.user)
        return func(self, request, *args, **kwargs)

    return wrapped
