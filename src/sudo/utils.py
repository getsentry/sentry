"""
sudo.utils
~~~~~~~~~~

:copyright: (c) 2020 by Matt Robenolt.
:license: BSD, see LICENSE for more details.
"""

from __future__ import annotations

from typing import cast

from django.core.signing import BadSignature
from django.http.request import HttpRequest
from django.utils.crypto import constant_time_compare, get_random_string

from sudo.settings import COOKIE_AGE, COOKIE_NAME, COOKIE_SALT


class _SudoRequest(HttpRequest):
    _sudo: bool
    _sudo_token: str
    _sudo_max_age: int


def _allow_sudo_attribute_stuffing(request: HttpRequest) -> _SudoRequest:
    # cast to our fake type which allows typesafe attribute stuffing
    return cast(_SudoRequest, request)


def grant_sudo_privileges(request: HttpRequest, max_age: int = COOKIE_AGE) -> str | None:
    """
    Assigns a random token to the user's session
    that allows them to have elevated permissions
    """
    request = _allow_sudo_attribute_stuffing(request)

    user = getattr(request, "user", None)

    # If there's not a user on the request, just noop
    if user is None:
        return None

    if not user.is_authenticated:
        raise ValueError("User needs to be logged in to be elevated to sudo")

    # Token doesn't need to be unique,
    # just needs to be unpredictable and match the cookie and the session
    token = get_random_string(12)
    request.session[COOKIE_NAME] = token
    request._sudo = True
    request._sudo_token = token
    request._sudo_max_age = max_age
    return token


def revoke_sudo_privileges(request: HttpRequest) -> None:
    """
    Revoke sudo privileges from a request explicitly
    """
    request = _allow_sudo_attribute_stuffing(request)

    request._sudo = False
    if COOKIE_NAME in request.session:
        del request.session[COOKIE_NAME]


def has_sudo_privileges(request: HttpRequest) -> bool:
    """
    Check if a request is allowed to perform sudo actions
    """
    request = _allow_sudo_attribute_stuffing(request)

    if getattr(request, "_sudo", None) is None:
        try:
            request._sudo = request.user.is_authenticated and constant_time_compare(
                request.get_signed_cookie(COOKIE_NAME, salt=COOKIE_SALT, max_age=COOKIE_AGE) or "",
                request.session[COOKIE_NAME],
            )
        except (KeyError, BadSignature):
            request._sudo = False
    return request._sudo
