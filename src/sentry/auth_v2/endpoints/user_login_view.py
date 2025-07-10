import logging
from typing import Any

from django.contrib.auth import authenticate, login
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.auth_v2.endpoints.session_builder import SessionBuilder
from sentry.auth_v2.serializers import SessionSerializer
from sentry.demo_mode.utils import is_demo_user
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.api.parsers.email import AllowedEmailField
from sentry.users.api.serializers.user import DetailedSelfUserSerializer
from sentry.utils import metrics
from sentry.utils.auth import get_login_redirect, get_org_redirect_url
from sentry.web.frontend.base import OrganizationMixin

from .base import AuthV2Endpoint

logger: logging.Logger = logging.getLogger(__name__)


class UserLoginRequestValidator(serializers.Serializer):
    email = AllowedEmailField(required=True)
    password = serializers.CharField(required=True)


@control_silo_endpoint
class UserLoginView(AuthV2Endpoint, OrganizationMixin):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.USER: RateLimit(limit=10, window=60),  # 10 per minute per user
            RateLimitCategory.IP: RateLimit(limit=20, window=60),  # 20 per minute per IP
        }
    }

    def get(self, request: Request) -> Response:
        return Response({"message": "Hello world"})

    def post(self, request: Request) -> Response:
        """
        Login a user via email/password.

        Related endpoints:
        - src/sentry/api/endpoints/auth_login.py AuthLoginEndpoint.post
        - src/sentry/web/frontend/auth_login.py AuthLoginView.post

        We will not implement basic auth for now:
        - src/sentry/api/endpoints/auth_index.py AuthIndexEndpoint.post
        """
        validator = UserLoginRequestValidator(data=request.data)
        if not validator.is_valid():
            return Response(
                {"detail": "invalid fields"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = validator.validated_data["email"]
        password = validator.validated_data["password"]

        # is_limited = ratelimiter.backend.is_limited(
        #     f"auth:form:username:{md5_text(email).hexdigest()}",
        #     limit=10,
        #     window=60,  # 10 per minute per username
        # )

        # if is_limited:
        #     metrics.incr(
        #         "login.attempt", instance="rate_limited", skip_internal=True, sample_rate=1.0
        #     )
        #     return Response(
        #         {"detail": "Login attempt failed"},
        #         status=status.HTTP_429_TOO_MANY_REQUESTS,
        #     )

        user = authenticate(username=email, password=password)

        if not user:
            return self._login_fail_response("invalid_credentials")
        elif is_demo_user(user):
            return self._login_fail_response("demo_user")
        elif user.is_anonymous:
            return self._login_fail_response("anonymous_user")
        elif not user.is_active:
            return self._login_fail_response("inactive_user")

        session_manager = SessionBuilder(request)
        session_manager.initialize_auth_flags()

        # TODO: Redirect users with no password to password reset or SSO page.

        # TODO: Figure out which org to send the user into

        login(request, user)
        metrics.incr("login.attempt", instance="success", skip_internal=True, sample_rate=1.0)
        return Response({"session": SessionSerializer().serialize(request)})
        # TODO: if hasattr(self, "active_organization") and self.active_organization:

    def _login_fail_response(self, reason: str) -> Response:
        metrics.incr(
            f"login.attempt.{reason}", instance="failure", skip_internal=True, sample_rate=1.0
        )

        return self.respond({"detail": f"Login attempt failed"}, status=status.HTTP_400_BAD_REQUEST)

    def _process_authenticated_user(
        self, request: Request, user: Any, auth_method: str
    ) -> Response:
        """Process an authenticated user and create session."""
        # Check if user has 2FA enabled

        # Generate redirect URL for form auth
        if auth_method == "form_auth":
            redirect_url = get_org_redirect_url(
                request, self.active_organization.organization if self.active_organization else None
            )
            return Response(
                {
                    "nextUri": get_login_redirect(request, redirect_url),
                    "user": serialize(user, user, DetailedSelfUserSerializer()),
                }
            )

        # For Basic Auth, return user data directly
        return Response(serialize(user, user, DetailedSelfUserSerializer()))
