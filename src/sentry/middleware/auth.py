from __future__ import annotations

from django.contrib.auth import get_user as auth_get_user
from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.deprecation import MiddlewareMixin
from django.utils.functional import SimpleLazyObject
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from sentry.api.authentication import (
    ApiKeyAuthentication,
    OrgAuthTokenAuthentication,
    UserAuthTokenAuthentication,
)
from sentry.models.userip import UserIP
from sentry.utils.auth import AuthUserPasswordExpired, logger
from sentry.utils.linksign import process_signature


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
                    extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": user.id},
                )
                user = AnonymousUser()
            else:
                UserIP.log(user, request.META["REMOTE_ADDR"])
        request._cached_user = user
    return request._cached_user


class SessionAuthenticationMiddleware(MiddlewareMixin):
    def process_request(self, request: HttpRequest) -> None:
        auth = get_authorization_header(request).split()

        if auth:
            for authenticator_class in [
                UserAuthTokenAuthentication,
                OrgAuthTokenAuthentication,
                ApiKeyAuthentication,
            ]:
                authenticator = authenticator_class()
                if not authenticator.accepts_auth(auth):
                    continue
                try:
                    result = authenticator.authenticate(request)
                except AuthenticationFailed:
                    result = None
                if result:
                    request.user, request.auth = result
                else:
                    # default to anonymous user and use IP ratelimit
                    request.user = SimpleLazyObject(lambda: get_user(request))
                return

        # default to anonymous user and use IP ratelimit
        request.user = SimpleLazyObject(lambda: get_user(request))

    def process_exception(
        self, request: HttpRequest, exception: Exception
    ) -> HttpResponseBase | None:
        if isinstance(exception, AuthUserPasswordExpired):
            from sentry.web.frontend.accounts import expired

            return expired(request, exception.user)
        else:
            return None


class AuthenticationMiddleware(SessionAuthenticationMiddleware):
    def process_request(self, request: HttpRequest) -> None:
        request.user_from_signed_request = False

        if request.path.startswith("/api/0/internal/rpc/"):
            # Avoid doing RPC authentication when we're already
            # in an RPC request.
            request.user = AnonymousUser()
            return

        # If there is a valid signature on the request we override the
        # user with the user contained within the signature.
        user = process_signature(request)

        if user is not None:
            request.user = user
            request.user_from_signed_request = True
            return

        return super().process_request(request)
