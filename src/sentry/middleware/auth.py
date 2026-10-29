from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user as auth_get_user
from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.deprecation import MiddlewareMixin
from django.utils.functional import SimpleLazyObject
from django.utils.module_loading import import_string
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from sentry.api.authentication import (
    AgentTokenAuthentication,
    ApiKeyAuthentication,
    OrgAuthTokenAuthentication,
    UserAuthTokenAuthentication,
    ViewerContextAuthentication,
)
from sentry.auth.principal import set_request_principal
from sentry.service_accounts.auth import is_service_account_auth
from sentry.users.models.userip import UserIP
from sentry.utils.auth import AuthUserPasswordExpired, logger

# Same order as the API, so rate limits key on the identity the endpoint gets.
TOKEN_AUTHENTICATION = (
    *map(import_string, settings.SENTRY_EXTRA_API_AUTHENTICATION),
    UserAuthTokenAuthentication,
    OrgAuthTokenAuthentication,
    AgentTokenAuthentication,
    ApiKeyAuthentication,
)


def get_user(request):
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
        request._cached_user = user
    return request._cached_user


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
            user, auth = result
            # Service accounts only call the API: session auth and web views must not
            # treat them as a logged-in user.
            if is_service_account_auth(auth):
                user = AnonymousUser()
            set_request_principal(request, user, auth)
            return

        # default to anonymous user and use IP ratelimit
        set_request_principal(request, SimpleLazyObject(lambda: get_user(request)), None)

    def process_exception(
        self, request: HttpRequest, exception: Exception
    ) -> HttpResponseBase | None:
        if isinstance(exception, AuthUserPasswordExpired):
            from sentry.users.web.accounts import expired

            return expired(request, exception.user)
        else:
            return None
