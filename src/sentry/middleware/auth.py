from __future__ import annotations

from django.contrib.auth import get_user as auth_get_user
from django.contrib.auth.models import AnonymousUser
from django.utils.deprecation import MiddlewareMixin
from django.utils.functional import SimpleLazyObject
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from sentry.api.authentication import ApiKeyAuthentication, TokenAuthentication
from sentry.models import UserIP
from sentry.services.hybrid_cloud.auth import auth_service, authentication_request_from
from sentry.silo import SiloMode
from sentry.utils.auth import AuthUserPasswordExpired, logger
from sentry.utils.linksign import process_signature
from sentry.utils.types import Any


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
                if SiloMode.get_current_mode() == SiloMode.MONOLITH:
                    UserIP.log(user, request.META["REMOTE_ADDR"])
        request._cached_user = user
    return request._cached_user


class AuthenticationMiddleware(MiddlewareMixin):
    @property
    def impl(self) -> Any:
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            return RequestAuthenticationMiddleware()
        return HybridCloudAuthenticationMiddleware()

    def process_request(self, request: Request):
        return self.impl.process_request(request)

    def process_exception(self, request: Request, exception):
        return self.impl.process_exception(request, exception)


class RequestAuthenticationMiddleware(MiddlewareMixin):
    def process_request(self, request: Request):
        request.user_from_signed_request = False

        # If there is a valid signature on the request we override the
        # user with the user contained within the signature.
        user = process_signature(request)
        auth = get_authorization_header(request).split()

        if user is not None:
            request.user = user
            request.user_from_signed_request = True
        elif auth and auth[0].lower() == TokenAuthentication.token_name:
            try:
                result = TokenAuthentication().authenticate(request=request)
            except AuthenticationFailed:
                result = None
            if result:
                request.user, request.auth = result
            else:
                # default to anonymous user and use IP ratelimit
                request.user = SimpleLazyObject(lambda: get_user(request))
        elif auth and auth[0].lower() == ApiKeyAuthentication.token_name:
            try:
                result = ApiKeyAuthentication().authenticate(request=request)
            except AuthenticationFailed:
                result = None
            if result:
                request.user, request.auth = result
            else:
                # default to anonymous user and use IP ratelimit
                request.user = SimpleLazyObject(lambda: get_user(request))
        else:
            request.user = SimpleLazyObject(lambda: get_user(request))

    def process_exception(self, request: Request, exception):
        if isinstance(exception, AuthUserPasswordExpired):
            from sentry.web.frontend.accounts import expired

            return expired(request, exception.user)


class HybridCloudAuthenticationMiddleware(MiddlewareMixin):
    def process_request(self, request: Request):
        from sentry.web.frontend.accounts import expired

        auth_result = auth_service.authenticate(request=authentication_request_from(request))
        request.user_from_signed_request = auth_result.user_from_signed_request

        if auth_result.auth is not None:
            request.auth = auth_result.auth
        if auth_result.expired:
            return expired(request, auth_result.user)
        elif auth_result.user is not None:
            request.user = auth_result.user
            UserIP.log(auth_result.user, request.META["REMOTE_ADDR"])
        else:
            request.user = AnonymousUser()

    def process_exception(self, request: Request, exception: Exception):
        pass
