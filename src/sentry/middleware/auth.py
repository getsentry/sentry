from __future__ import annotations

from django.contrib.auth import get_user as auth_get_user
from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.deprecation import MiddlewareMixin
from django.utils.functional import SimpleLazyObject

from sentry.users.models.user import User
from sentry.users.models.userip import UserIP
from sentry.utils.auth import AuthUserPasswordExpired, logger


def _get_user(request: HttpRequest) -> User | AnonymousUser:
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
    return user


class AuthenticationMiddleware(MiddlewareMixin):
    def process_request(self, request: HttpRequest) -> None:
        request.auth = None  # request.auth will be set by rest_framework

        if request.path.startswith("/api/0/internal/rpc/"):
            # Avoid doing RPC authentication when we're already
            # in an RPC request.
            request.user = AnonymousUser()
        else:
            # default to anonymous user and use IP ratelimit
            request.user = SimpleLazyObject(lambda: _get_user(request))  # type: ignore[assignment]  # proxy object faking the real one

    def process_exception(
        self, request: HttpRequest, exception: Exception
    ) -> HttpResponseBase | None:
        if isinstance(exception, AuthUserPasswordExpired):
            from sentry.users.web.accounts import expired

            return expired(request, exception.user)
        else:
            return None
