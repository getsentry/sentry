from __future__ import annotations

from time import time

from django.conf import settings
from django.contrib.auth import SESSION_KEY
from django.contrib.auth import get_user as auth_get_user
from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.cache import get_max_age
from django.utils.deprecation import MiddlewareMixin
from django.utils.functional import SimpleLazyObject
from django.utils.module_loading import import_string
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from sentry import features
from sentry.api.authentication import (
    AgentTokenAuthentication,
    ApiKeyAuthentication,
    OrgAuthTokenAuthentication,
    ServiceAccountTokenAuthentication,
    UserAuthTokenAuthentication,
    ViewerContextAuthentication,
)
from sentry.auth.principal import set_request_principal
from sentry.users.models.user import User
from sentry.users.models.userip import UserIP
from sentry.utils.auth import AuthUserPasswordExpired, logger

# Same order as the API, so rate limits key on the identity the endpoint gets.
TOKEN_AUTHENTICATION = (
    *map(import_string, settings.SENTRY_EXTRA_API_AUTHENTICATION),
    UserAuthTokenAuthentication,
    OrgAuthTokenAuthentication,
    ServiceAccountTokenAuthentication,
    AgentTokenAuthentication,
    ApiKeyAuthentication,
)


SESSION_RENEWED_AT_KEY = "_renewed_at"


def get_session_renew_interval() -> int:
    """
    How old a session gets, in seconds, before `renew_session` saves it again: a day, or half
    the session's life when that is shorter.
    """
    return min(24 * 60 * 60, settings.SESSION_COOKIE_AGE // 2)


def renew_session(request: HttpRequest, response: HttpResponseBase) -> None:
    """
    Keeps a user signed in while they are active.

    A session ends `SESSION_COOKIE_AGE` after it was last saved, which is usually when the user
    signed in. Saving it again whenever the user makes a request with a session older than
    `get_session_renew_interval` turns that into a limit on inactivity.

    Only requests for an organization with `organizations:sliding-session-expiry` renew the
    session.
    """
    # `get_user` only caches a user when the session signed them in. A token doesn't.
    user = getattr(request, "_cached_user", None)
    if user is None or not user.is_authenticated:
        return

    # Signing out or signing in as someone else replaces the session during the request
    if request.session.get(SESSION_KEY) != str(user.id):
        return

    # Django doesn't save the session of a failed request, and a response that may be cached
    # must not carry anyone's session.
    if response.status_code >= 500 or get_max_age(response):
        return

    now = int(time())
    renewed_at = request.session.get(SESSION_RENEWED_AT_KEY)
    if renewed_at is not None and now - renewed_at < get_session_renew_interval():
        return

    # Organization and project endpoints set the request's organization
    organization = getattr(request, "organization", None)
    if organization is None or not features.has(
        "organizations:sliding-session-expiry", organization, actor=user
    ):
        return

    request.session[SESSION_RENEWED_AT_KEY] = now


def get_user(request: HttpRequest) -> User | AnonymousUser:
    if not hasattr(request, "_cached_user"):
        user = auth_get_user(request)
        # If the user bound to this request matches a real user,
        # we need to validate the session's nonce. This nonce is
        # to make sure that the session is valid for effectively the
        # current "version" of the user. When security related
        # actions take place, this nonce will rotate causing a
        # mismatch here forcing the session to be logged out and
        # requiring re-validation.
        if user.is_authenticated and not user.is_sentry_app:
            # We only need to check the nonce if there is a nonce
            # currently set on the User. By default, the value will
            # be None until the first action has been taken, at
            # which point, a nonce will always be required.
            if user.session_nonce and request.session.get("_nonce", "") != user.session_nonce:
                # If the nonces don't match, this session is anonymous.
                logger.info(
                    "user.auth.invalid-nonce",
                    extra={
                        "ip_address": request.META["REMOTE_ADDR"],
                        "user_id": user.id,
                    },
                )
                user = AnonymousUser()
            else:
                UserIP.log(user, request.META["REMOTE_ADDR"])
        setattr(request, "_cached_user", user)
    cached_user: User | AnonymousUser = getattr(request, "_cached_user")
    return cached_user


class AuthenticationMiddleware(MiddlewareMixin):
    def process_request(self, request: Request) -> None:
        if request.path.startswith("/api/0/internal/rpc/"):
            # Avoid doing RPC authentication when we're already
            # in an RPC request.
            set_request_principal(request, AnonymousUser(), None)
            return

        auth = get_authorization_header(request).split()

        if auth:
            for authenticator_class in TOKEN_AUTHENTICATION:
                authenticator = authenticator_class()
                if not authenticator.accepts_auth(auth):
                    continue
                try:
                    result = authenticator.authenticate(request)
                except AuthenticationFailed:
                    result = None
                if result:
                    set_request_principal(request, *result)
                else:
                    # default to anonymous user and use IP ratelimit
                    set_request_principal(
                        request, SimpleLazyObject(lambda: get_user(request)), None
                    )
                return

        # Try viewer context authentication (signed headers from trusted services)
        try:
            result = ViewerContextAuthentication().authenticate(request)
        except AuthenticationFailed:
            result = None
        if result:
            set_request_principal(request, *result)
            return

        # default to anonymous user and use IP ratelimit
        set_request_principal(request, SimpleLazyObject(lambda: get_user(request)), None)

    def process_response(
        self, request: HttpRequest, response: HttpResponseBase
    ) -> HttpResponseBase:
        renew_session(request, response)
        return response

    def process_exception(
        self, request: HttpRequest, exception: Exception
    ) -> HttpResponseBase | None:
        if isinstance(exception, AuthUserPasswordExpired):
            from sentry.users.web.accounts import expired

            return expired(request, exception.user)
        else:
            return None
